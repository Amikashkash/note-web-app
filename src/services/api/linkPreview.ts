/**
 * Link Preview Service - Fetch metadata from URLs
 */

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

/**
 * Extract Open Graph and meta tags from HTML
 */
const extractMetadata = (html: string, url: string): LinkPreviewData => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Helper to get meta tag content
  const getMeta = (property: string): string | null => {
    // Try og: first
    let tag = doc.querySelector(`meta[property="${property}"]`);
    if (tag) return tag.getAttribute('content');

    // Try name attribute
    tag = doc.querySelector(`meta[name="${property}"]`);
    if (tag) return tag.getAttribute('content');

    return null;
  };

  // Extract metadata
  const title = getMeta('og:title') ||
                getMeta('twitter:title') ||
                doc.querySelector('title')?.textContent ||
                url;

  const description = getMeta('og:description') ||
                      getMeta('twitter:description') ||
                      getMeta('description') ||
                      '';

  const image = getMeta('og:image') ||
                getMeta('twitter:image') ||
                '';

  const siteName = getMeta('og:site_name') ||
                   new URL(url).hostname;

  // Get favicon
  let favicon = '';
  const iconLink = doc.querySelector('link[rel="icon"]') ||
                   doc.querySelector('link[rel="shortcut icon"]');
  if (iconLink) {
    const href = iconLink.getAttribute('href');
    if (href) {
      favicon = href.startsWith('http') ? href : new URL(href, url).href;
    }
  }
  if (!favicon) {
    favicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  }

  return {
    url,
    title: title?.trim(),
    description: description?.trim().substring(0, 200), // Limit description
    image: image?.trim(),
    siteName: siteName?.trim(),
    favicon: favicon.trim(),
  };
};

/**
 * Fetch link preview data from a URL
 */
export const fetchLinkPreview = async (url: string): Promise<LinkPreviewData> => {
  try {
    // Validate URL
    new URL(url); // Throws if invalid

    // Use CORS proxy to fetch the page
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractMetadata(html, url);

  } catch (error) {
    console.error('Link preview fetch error:', error);

    // Return minimal data if fetch fails
    return {
      url,
      title: url,
      siteName: new URL(url).hostname,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
    };
  }
};

/**
 * Extract all URLs from text
 */
export const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

/**
 * Check if a string is a valid URL
 */
export const isValidUrl = (str: string): boolean => {
  try {
    new URL(str);
    return str.startsWith('http://') || str.startsWith('https://');
  } catch {
    return false;
  }
};
