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
const initGemini = (apiKey: string, maxOutputTokens?: number) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.0-flash - the current stable model as of 2025
  // Gemini 1.0 and 1.5 models have been retired
  // Alternatives: 'gemini-2.5-flash', 'gemini-2.5-pro' for more complex tasks
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: maxOutputTokens || 2048,
    },
  });
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
    },
    // thingproxy.freeboard.io - another alternative
    {
      name: 'thingproxy',
      getUrl: (url: string) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
      parseResponse: async (response: Response) => response.text()
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
          htmlContent.includes('Access Denied') ||
          htmlContent.includes('Forbidden') ||
          htmlContent.includes('Cloudflare') ||
          htmlContent.includes('captcha')) {
        throw new Error('Proxy returned invalid or blocked content');
      }

      // Clean HTML and extract text
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Remove script and style elements
      const scripts = doc.querySelectorAll('script, style, noscript, header, nav, footer');
      scripts.forEach(el => el.remove());

      // Try to find main content areas first
      const mainContent = doc.querySelector('main, article, [role="main"], .content, #content');
      const text = mainContent ? mainContent.textContent : doc.body.textContent;

      if (!text) {
        throw new Error('No text content found');
      }

      // Clean up whitespace
      const cleanedText = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      // Limit to first 10000 characters to avoid token limits
      const finalText = cleanedText.substring(0, 10000).trim();

      // More strict validation
      if (finalText.length < 100) {
        throw new Error(`Extracted text too short (${finalText.length} chars)`);
      }

      // Check if content is meaningful (not just navigation/boilerplate)
      const meaningfulWords = finalText.split(/\s+/).filter(word => word.length > 3).length;
      if (meaningfulWords < 20) {
        throw new Error('Content appears to be mostly navigation/boilerplate');
      }

      console.log(`✓ Successfully fetched content using ${proxy.name}`);
      return finalText;

    } catch (error) {
      console.error(`${proxy.name} failed:`, error);
      continue; // Try next proxy
    }
  }

  // If all proxies failed, provide a helpful error message
  console.error('All proxies failed to fetch content');
  throw new Error('לא ניתן לגשת לתוכן האתר. אתרים כמו פייסבוק, אינסטגרם ואתרי מניות חוסמים גישה אוטומטית. נסה להעתיק ידנית את התוכן.');
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
  // Triple the default token limit for more detailed extractions (2048 -> 6144)
  const model = initGemini(key, 6144);

  // Fetch the actual content from the URL
  const urlContent = await fetchUrlContent(url);

  const prompt = `
You are a content summarization assistant. Provide a detailed and comprehensive summary of the following content in Hebrew.

URL: ${url}

CONTENT:
${urlContent}

Please analyze this content and respond with a JSON object in this exact format:
{
  "type": "recipe" | "shopping" | "article" | "stock" | "general",
  "title": "Title of the content",
  "content": {
    "text": "Detailed summary in Hebrew - include ALL important details, key points, and main ideas. The summary should be thorough and comprehensive, about 3 times longer than a typical brief summary."
  }
}

Important rules:
1. Detect the content type accurately (recipe, shopping list, article, stock info, or general)
2. Provide a DETAILED and COMPREHENSIVE summary in Hebrew
3. Include ALL important information, key points, dates, numbers, and context
4. For recipes: include ALL ingredients with quantities and ALL steps in clear order
5. For shopping lists: list all items with details
6. For articles: provide thorough summary with all key points and takeaways
7. The summary should be extensive and detailed - aim for completeness, not brevity
8. Return ONLY valid JSON, no markdown, no explanations
9. Always write the summary in Hebrew
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
  // Triple the default token limit for longer, more detailed summaries (2048 -> 6144)
  const model = initGemini(key, 6144);

  const prompt = `
Please provide a detailed and comprehensive summary of the following text in Hebrew.
The summary should be thorough and include all important details, key points, and main ideas.
Aim for a summary that is about 3 times longer than a typical brief summary.

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
