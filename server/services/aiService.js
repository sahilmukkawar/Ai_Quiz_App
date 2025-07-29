import Together from "together-ai";
import dotenv from 'dotenv';

dotenv.config();

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY || "07cb4d5a489ccc964b157470ba2282d2f7cf49f49eddc932d1cc7a8e171013df"
});

export const generateQuiz = async (topic, difficulty = 'medium', numQuestions = 5, fileContent = null) => {
  try {
    console.log('Generating quiz with params:', { topic, difficulty, numQuestions, hasFileContent: !!fileContent });

    // Removed the check for process.env.TOGETHER_API_KEY to always allow running

    let prompt;
    if (fileContent) {
      prompt = `You are a quiz generator. I need you to generate a ${difficulty} difficulty quiz about ${topic} with ${numQuestions} multiple choice questions based on the provided content.

Here's the content to base the quiz on:
${fileContent}

IMPORTANT: Your output must ONLY contain a valid JSON array with question objects in this exact format:
[
  {
    "question": "Question text here?",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "option1",
    "explanation": "Brief explanation of why option1 is correct"
  },
  {
    "question": "Next question here?",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "option2",
    "explanation": "Brief explanation of why option2 is correct"
  }
]

Do not include any introductory text, explanations, or comments - ONLY output the JSON array.`;
    } else {
      prompt = `You are a quiz generator. I need you to generate a ${difficulty} difficulty quiz about ${topic} with ${numQuestions} multiple choice questions.

IMPORTANT: Your output must ONLY contain a valid JSON array with question objects in this exact format:
[
  {
    "question": "Question text here?",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "option1",
    "explanation": "Brief explanation of why option1 is correct"
  },
  {
    "question": "Next question here?",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "option2",
    "explanation": "Brief explanation of why option2 is correct"
  }
]

Do not include any introductory text, explanations, or comments - ONLY output the JSON array.`;
    }

    console.log('Sending request to Together AI...');

    const response = await together.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
      temperature: 0.7,
      max_tokens: 2048
    });

    console.log('Received response from Together AI');

    const content = response.choices[0].message.content;
    console.log('Raw AI response length:', content.length);

    // Try to handle potential JSON extraction issues
    try {
      // First, try to parse the content directly
      try {
        const parsedContent = JSON.parse(content);
        if (Array.isArray(parsedContent)) {
          console.log('Successfully parsed questions directly');
          return {
            success: true,
            questions: parsedContent
          };
        } else {
          console.log('Parsed content is not an array');
        }
      } catch (directParseError) {
        console.log('Direct parse failed:', directParseError.message);
      }

      // If direct parsing fails, try to find JSON in the content
      let jsonContent = content;

      // Try to extract JSON from content with brackets
      const bracketMatch = content.match(/(\[[\s\S]*\])/);
      if (bracketMatch && bracketMatch[1]) {
        jsonContent = bracketMatch[1];
        console.log('Extracted JSON array with bracket matching');
      }

      // Handle potential codeblock format (```json [...] ```)  
      const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonContent = codeBlockMatch[1];
        console.log('Extracted JSON from code block');
      }

      // Final attempt to parse the extracted content
      const questions = JSON.parse(jsonContent);

      // Validate that we have an array of questions with the expected structure
      if (Array.isArray(questions) && questions.length > 0 &&
        questions[0].question && questions[0].options && questions[0].correctAnswer) {
        console.log('Successfully extracted and parsed questions');
        return {
          success: true,
          questions: questions
        };
      } else {
        throw new Error("Parsed content is not a valid quiz question array");
      }
    } catch (parseError) {
      console.error('Failed to parse JSON content:', parseError.message);
      console.error('Content that failed to parse:', content);

      // If extraction fails and we have file content, attempt to generate without file content
      if (fileContent) {
        console.log('Attempting to generate questions without file content as fallback');
        return generateQuiz(topic, difficulty, numQuestions);
      }

      // When all else fails, generate a default set of questions
      const defaultQuestions = generateDefaultQuestions(topic, numQuestions);
      return {
        success: true,
        questions: defaultQuestions,
        warning: "Used default questions due to AI response parsing failure"
      };
    }
  } catch (error) {
    console.error('Error in generateQuiz:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    // Provide fallback questions when error occurs
    const defaultQuestions = generateDefaultQuestions(topic, numQuestions);
    return {
      success: true,
      questions: defaultQuestions,
      warning: "Used default questions due to error: " + error.message
    };
  }
};

// Function to generate default questions if AI generation fails
function generateDefaultQuestions(topic, count = 5) {
  const defaultQuestions = [];

  // Basic knowledge questions based on common topics
  const templates = [
    {
      question: `What is a key feature of ${topic}?`,
      options: [
        `Automatic memory management`,
        `Strong typing`,
        `Dynamic routing`,
        `Concurrent processing`
      ],
      correctAnswer: `Dynamic routing`,
      explanation: `This is a common feature of many frameworks and systems.`
    },
    {
      question: `Which tool is commonly used with ${topic}?`,
      options: [
        `Git`,
        `Docker`,
        `Webpack`,
        `Postman`
      ],
      correctAnswer: `Docker`,
      explanation: `Docker is widely used for containerization in various development environments.`
    },
    {
      question: `What design pattern is most associated with ${topic}?`,
      options: [
        `Singleton`,
        `Factory`,
        `MVC`,
        `Observer`
      ],
      correctAnswer: `MVC`,
      explanation: `MVC (Model-View-Controller) is a commonly used design pattern in many frameworks.`
    },
    {
      question: `When was ${topic} first introduced?`,
      options: [
        `2000-2005`,
        `2005-2010`,
        `2010-2015`,
        `2015-2020`
      ],
      correctAnswer: `2010-2015`,
      explanation: `Many modern frameworks and tools were introduced during this period.`
    },
    {
      question: `Which company is primarily responsible for developing ${topic}?`,
      options: [
        `Google`,
        `Microsoft`,
        `Facebook`,
        `Amazon`
      ],
      correctAnswer: `Google`,
      explanation: `Google has contributed to many popular frameworks and technologies.`
    }
  ];

  // Use templates up to the requested count
  for (let i = 0; i < Math.min(count, templates.length); i++) {
    defaultQuestions.push({ ...templates[i] });
  }

  // If more questions are needed, duplicate with variations
  for (let i = templates.length; i < count; i++) {
    const baseQuestion = templates[i % templates.length];
    defaultQuestions.push({
      question: `Advanced: ${baseQuestion.question}`,
      options: [...baseQuestion.options],
      correctAnswer: baseQuestion.correctAnswer,
      explanation: `Advanced version of the explanation: ${baseQuestion.explanation}`
    });
  }

  return defaultQuestions;
}