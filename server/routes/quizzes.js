import express from 'express';
import { generateQuiz } from '../services/aiService.js';
import Quiz from '../models/Quiz.js';
import auth from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only PDF, TXT, and Word documents
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, and Word documents are allowed.'));
    }
  }
});

// Generate quiz using AI
router.post('/ai/generate-quiz', auth, async (req, res) => {
  try {
    const { topic, numQuestions, difficulty = 'medium' } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    const result = await generateQuiz(topic, difficulty, numQuestions || 10);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate quiz'
    });
  }
});

// Create quiz from file upload
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, topic, numQuestions } = req.body;

    if (!title || !topic || !numQuestions) {
      // Clean up the uploaded file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let fileContent = '';
    try {
      // Check file size
      const stats = fs.statSync(req.file.path);
      if (stats.size === 0) {
        throw new Error('Uploaded file is empty');
      }

      // Read file content based on file type
      if (req.file.mimetype === 'text/plain') {
        fileContent = fs.readFileSync(req.file.path, 'utf8');
      } else {
        // For PDF and Word docs, we might need specific parsing libraries
        // For now, let's indicate that the file is binary
        fileContent = `Content extracted from ${path.basename(req.file.path)}`;
        // Consider adding PDF.js or mammoth.js for proper parsing
      }

      // Check if file content is readable
      if (!fileContent || fileContent.trim().length < 10) {
        throw new Error('File content is empty or unreadable');
      }
    } catch (fileError) {
      console.error('Error reading file:', fileError);
      // Clean up the uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: `Error reading file: ${fileError.message}` });
    }

    // Generate quiz using AI service
    console.log(`Generating quiz from file: ${req.file.originalname}`);
    const aiResponse = await generateQuiz(topic, 'medium', parseInt(numQuestions), fileContent);

    // Create new quiz
    const quiz = new Quiz({
      title,
      topic,
      questions: aiResponse.questions,
      settings: {
        numQuestions: parseInt(numQuestions),
        timeLimit: 30 // Default time limit
      },
      createdBy: req.user.userId
    });

    await quiz.save();

    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Include warning in response if any
    const response = { ...quiz.toObject() };
    if (aiResponse.warning) {
      response.warning = aiResponse.warning;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating quiz from file:', error);

    // Clean up the uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ message: error.message });
  }
});

// Get all quizzes
router.get('/', auth, async (req, res) => {
  try {
    const quizzes = await Quiz.find().sort({ createdAt: -1 });
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's quizzes
router.get('/user', auth, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ createdBy: req.user.userId }).sort({ createdAt: -1 });
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get quiz by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create quiz
router.post('/', auth, async (req, res) => {
  try {
    const { title, topic, settings, questions } = req.body;

    if (!title || !topic || !settings) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate questions if not provided
    let quizQuestions = questions;
    if (!quizQuestions) {
      const aiResponse = await generateQuiz(topic, 'medium', settings.numQuestions);
      if (!aiResponse.success) {
        throw new Error(aiResponse.error || 'Failed to generate quiz');
      }
      quizQuestions = aiResponse.questions;
    }

    const quiz = new Quiz({
      title,
      topic,
      settings,
      questions: quizQuestions,
      createdBy: req.user.userId
    });

    await quiz.save();
    res.status(201).json(quiz);
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update quiz
router.put('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    Object.assign(quiz, req.body);
    await quiz.save();
    res.json(quiz);
  } catch (error) {
    console.error('Error updating quiz:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating quiz' });
  }
});

// Delete quiz
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Quiz.deleteOne({ _id: req.params.id, createdBy: req.user.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json({ message: 'Quiz deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;