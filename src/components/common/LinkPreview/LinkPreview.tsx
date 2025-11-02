/**
 * LinkPreview Component - Display rich preview cards for URLs
 */

import React, { useState, useEffect } from 'react';
import { fetchLinkPreview, type LinkPreviewData } from '@/services/api/linkPreview';

interface LinkPreviewProps {
  url: string;
  className?: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url, className = '' }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPreview = async () => {
      try {
        setLoading(true);
        setError(false);
        const data = await fetchLinkPreview(url);
        if (mounted) {
          setPreview(data);
        }
      } catch (err) {
        console.error('Failed to load link preview:', err);
        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      mounted = false;
    };
  }, [url]);

  if (loading) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
        </div>
      </a>
    );
  }

  if (error || !preview) {
    // Fallback to simple link
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline ${className}`}
      >
        🔗 {url}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all ${className}`}
      dir="ltr"
    >
      {/* Image preview (if available) */}
      {preview.image && (
        <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800">
          <img
            src={preview.image}
            alt={preview.title || ''}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image if it fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Site name with favicon */}
        {preview.siteName && (
          <div className="flex items-center gap-2 mb-2">
            {preview.favicon && (
              <img
                src={preview.favicon}
                alt=""
                className="w-4 h-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
              {preview.siteName}
            </span>
          </div>
        )}

        {/* Title */}
        {preview.title && (
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
            {preview.title}
          </h3>
        )}

        {/* Description */}
        {preview.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {preview.description}
          </p>
        )}

        {/* URL */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 truncate">
          {preview.url}
        </p>
      </div>
    </a>
  );
};
