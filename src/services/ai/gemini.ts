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
  // Using gemini-2.0-flash - the current stable model as of 2025
  // Gemini 1.0 and 1.5 models have been retired
  // Alternatives: 'gemini-2.5-flash', 'gemini-2.5-pro' for more complex tasks
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
};

/**
 * Fetch URL content using a CORS proxy
 * Tries multiple proxy services for better reliability
 */
const fetchUrlContent = async (url: string): Promise<string> => {
  // List of CORS proxy services to try
  const proxies = [
    // corsproxy.io - supports JavaScript-heavy sites
    {
      name: 'corsproxy',
      getUrl: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      parseResponse: async (response: Response) => response.text()
    },
    // api.allorigins.win - fallback
    {
      name: 'allorigins',
      getUrl: (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      parseResponse: async (response: Response) => {
        const data = await response.json();
        return data.contents || '';
      }
    }
  ];

  // Try each proxy until one works
  for (const proxy of proxies) {
    try {
      console.log(`Trying ${proxy.name} proxy...`);
      const proxyUrl = proxy.getUrl(url);
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const htmlContent = await proxy.parseResponse(response);

      // Check if we got actual content (not an error page)
      if (htmlContent.length < 100 ||
          htmlContent.includes('Enable JavaScript') ||
          htmlContent.includes('Access Denied')) {
        throw new Error('Proxy returned invalid content');
      }

      // Clean HTML and extract text
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Remove script and style elements
      const scripts = doc.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());

      // Get text content
      const text = doc.body.textContent || '';
      const cleanedText = text.replace(/\s+/g, ' ').trim();

      // Limit to first 10000 characters to avoid token limits
      const finalText = cleanedText.substring(0, 10000).trim();

      if (finalText.length < 50) {
        throw new Error('Extracted text too short');
      }

      console.log(`✓ Successfully fetched content using ${proxy.name}`);
      return finalText;

    } catch (error) {
      console.error(`${proxy.name} failed:`, error);
      continue; // Try next proxy
    }
  }

  // If all proxies failed, just pass the URL to Gemini
  console.warn('All proxies failed, sending URL directly to Gemini');
  return `URL: ${url}\n\nNote: Could not fetch content automatically. Please analyze this URL directly.`;
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
