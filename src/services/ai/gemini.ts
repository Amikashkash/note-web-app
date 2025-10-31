/**
 * Gemini AI Service - Content extraction and summarization
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIExtractionResult {
  type: 'recipe' | 'shopping' | 'article' | 'stock' | 'general';
  title: string;
  content: any; // Will be structured based on type
  rawText?: string;
}

/**
 * Initialize Gemini AI
 */
const initGemini = (apiKey: string) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

/**
 * Extract content from URL using Gemini AI
 */
export const extractContentFromUrl = async (
  url: string,
  apiKey: string
): Promise<AIExtractionResult> => {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const model = initGemini(apiKey);

  const prompt = `
You are a content extraction assistant. Analyze the following URL and extract structured information.

URL: ${url}

Please analyze this URL and respond with a JSON object in this exact format:
{
  "type": "recipe" | "shopping" | "article" | "stock" | "general",
  "title": "Title of the content",
  "content": {
    // Structure based on type:
    // For "recipe": { "servings": "", "prepTime": "", "cookTime": "", "ingredients": ["item1", "item2"], "steps": ["step1", "step2"] }
    // For "shopping": { "items": [{"name": "item", "quantity": "", "category": ""}] }
    // For "article": { "summary": "...", "keyPoints": ["point1", "point2"] }
    // For "stock": { "symbol": "", "price": "", "change": "", "summary": "" }
    // For "general": { "text": "..." }
  }
}

Important rules:
1. Detect the content type accurately (recipe, shopping list, article, stock info, or general)
2. Extract all relevant information
3. For recipes: include ALL ingredients and steps in order
4. For shopping lists: categorize items if possible
5. Return ONLY valid JSON, no markdown, no explanations
6. If you cannot access the URL, analyze the URL pattern and make best effort extraction
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const extracted: AIExtractionResult = JSON.parse(jsonMatch[0]);
    extracted.rawText = text;

    return extracted;
  } catch (error) {
    console.error('Gemini AI Error:', error);
    throw new Error('Failed to extract content from URL. Please try again.');
  }
};

/**
 * Summarize text content
 */
export const summarizeText = async (text: string, apiKey: string): Promise<string> => {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const model = initGemini(apiKey);

  const prompt = `
Please provide a concise summary of the following text in Hebrew:

${text}

Summary:
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini AI Error:', error);
    throw new Error('Failed to summarize text');
  }
};
