'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  cacheBustKey?: string;
}

export function SafeImage({
  src,
  alt,
  className,
  fallbackSrc,
  cacheBustKey,
  ...props
}: SafeImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState('');

  useEffect(() => {
    if (!src) {
      setError(true);
      setLoading(false);
      return;
    }

    let url = src;
    const queryParams: string[] = [];

    if (cacheBustKey) {
      queryParams.push(`v=${encodeURIComponent(cacheBustKey)}`);
    }

    if (retryCount > 0) {
      queryParams.push(`retry=${retryCount}`);
    }

    if (queryParams.length > 0) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${queryParams.join('&')}`;
    }

    setCurrentSrc(url);
    setLoading(true);
    setError(false);
  }, [src, cacheBustKey, retryCount]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoading(false);
    setError(false);
    if (props.onLoad) {
      props.onLoad(e);
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoading(false);
    setError(true);
    if (props.onError) {
      props.onError(e);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(false);
    setRetryCount((prev) => prev + 1);
  };

  return (
    <div className={cn("relative w-full h-full flex items-center justify-center bg-neutral-100 overflow-hidden group/image", className)}>
      {/* Loading state / Skeleton */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 animate-pulse z-10">
          <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
        </div>
      )}

      {/* Error / Fallback State */}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 bg-neutral-50 text-neutral-400 text-center select-none z-10 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-400 mb-0.5" />
          <span className="text-[10px] font-medium text-neutral-500 leading-tight">Failed to load</span>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-white hover:bg-neutral-100 border border-neutral-200 text-[10px] font-semibold text-neutral-600 shadow-sm transition"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Retry
          </button>
        </div>
      ) : (
        /* Image Element */
        <img
          src={currentSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200",
            loading ? "opacity-0" : "opacity-100"
          )}
          {...props}
        />
      )}
    </div>
  );
}
