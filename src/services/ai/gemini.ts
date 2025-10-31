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
 * Fetch URL content using a CORS proxy
 */
const fetchUrlContent = async (url: string): Promise<string> => {
  try {
    // Use allorigins.win as CORS proxy (free service)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();

    if (!data.contents) {
      throw new Error('Failed to fetch URL content');
    }

    // Clean HTML and extract text (simple approach)
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, 'text/html');

    // Remove script and style elements
    const scripts = doc.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());

    // Get text content
    const text = doc.body.textContent || '';

    // Limit to first 10000 characters to avoid token limits
    return text.substring(0, 10000).trim();
  } catch (error) {
    console.error('URL Fetch Error:', error);
    // Fallback: just use the URL itself
    return `URL: ${url}`;
  }
};

/**
 * Get Gemini API key from environment or parameter
 */
const getApiKey = (providedKey?: string): string => {
  // First try provided key (for backward compatibility)
  if (providedKey) {
    return providedKey;
  }

  // Then try environment variable
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey) {
    return envKey;
  }

  throw new Error('Gemini API key not configured');
};

/**
 * Extract content from URL using Gemini AI
 */
export const extractContentFromUrl = async (
  url: string,
  apiKey?: string
): Promise<AIExtractionResult> => {
  const key = getApiKey(apiKey);
  const model = initGemini(key);

  // Fetch the actual content from the URL
  const urlContent = await fetchUrlContent(url);

  const prompt = `
You are a content extraction assistant. Analyze the following content from a URL and extract structured information.

URL: ${url}

CONTENT:
${urlContent}

Please analyze this content and respond with a JSON object in this exact format:
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
3. For recipes: include ALL ingredients with quantities and ALL steps in order
4. For shopping lists: categorize items if possible
5. Return ONLY valid JSON, no markdown, no explanations
6. Use Hebrew for summaries when possible
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response - handle both with and without markdown code blocks
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response - no JSON found');
    }

    const extracted: AIExtractionResult = JSON.parse(jsonMatch[0]);
    extracted.rawText = text;

    return extracted;
  } catch (error) {
    console.error('Gemini AI Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract content: ${errorMessage}`);
  }
};

/**
 * Summarize text content
 */
export const summarizeText = async (text: string, apiKey?: string): Promise<string> => {
  const key = getApiKey(apiKey);
  const model = initGemini(key);

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
