import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../contexts/QuizContext';
import { Loader2, Plus, AlertCircle, Upload } from 'lucide-react';
import api from '../config/axios';

interface QuizSettings {
  numQuestions: number;
  timeLimit: number;
}

interface QuizData {
  title: string;
  topic: string;
  settings: QuizSettings;
}

const CreateQuiz: React.FC = () => {
  const navigate = useNavigate();
  const { createQuiz, loading } = useQuiz();
  
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState(30);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Check file type
      if (selectedFile.type !== 'application/pdf' && 
          selectedFile.type !== 'text/plain' && 
          selectedFile.type !== 'application/msword' &&
          selectedFile.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setError('Please upload a PDF, TXT, or Word document');
        return;
      }
      // Check file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size should be less than 5MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a quiz title');
      return;
    }

    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    try {
      setGenerating(true);
      const quizData: QuizData = {
        title,
        topic,
        settings: {
          numQuestions,
          timeLimit
        }
      };
      
      let newQuiz;
      
      if (file) {
        // If file is uploaded, use it to generate quiz
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('topic', topic);
        formData.append('numQuestions', numQuestions.toString());
        
        const response = await api.post('/quizzes/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        newQuiz = response.data;
      } else {
        // Otherwise use the regular quiz creation
        newQuiz = await createQuiz(quizData);
      }
      
      if (!newQuiz || !newQuiz._id) {
        throw new Error('Failed to create quiz: No quiz ID received');
      }

      navigate(`/take-quiz/${newQuiz._id}`, { replace: true });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create quiz. Please try again.';
      setError(errorMessage);
      console.error('Quiz creation error:', err);
      
      if (errorMessage.includes('timeout')) {
        setError('The quiz generation is taking longer than expected. Please try again in a few moments.');
      }
    } finally {
      setGenerating(false);
      setUploading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-4rem)] py-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create a New Quiz</h1>
          
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="ml-3 text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Quiz Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. Introduction to Physics"
              />
            </div>

            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700">
                Topic *
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. Newton's Laws of Motion"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="numQuestions" className="block text-sm font-medium text-gray-700">
                  Number of Questions
                </label>
                <select
                  id="numQuestions"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value={5}>5 questions</option>
                  <option value={10}>10 questions</option>
                  <option value={15}>15 questions</option>
                  <option value={20}>20 questions</option>
                </select>
              </div>

              <div>
                <label htmlFor="timeLimit" className="block text-sm font-medium text-gray-700">
                  Time Limit (minutes)
                </label>
                <select
                  id="timeLimit"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
            </div>

            {/* File Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Content (Optional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={handleFileChange}
                        accept=".pdf,.txt,.doc,.docx"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PDF, TXT, or Word document up to 5MB
                  </p>
                  {file && (
                    <p className="text-sm text-indigo-600">
                      Selected file: {file.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || generating || uploading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
              >
                {generating || uploading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    {uploading ? 'Processing File...' : 'Generating Quiz...'}
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    Create Quiz
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateQuiz;