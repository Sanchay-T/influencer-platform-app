/**
 * ============================================================================
 * PROPOSED SOLUTION - Image Fallback System
 * ============================================================================
 *
 * This file contains the production-ready code to fix the image loading issues.
 * Copy these components/hooks into the main codebase when ready to implement.
 *
 * ============================================================================
 */

import React, { useState, useCallback, useMemo } from 'react';

// ============================================================================
// 1. FALLBACK PLACEHOLDER COMPONENT
// ============================================================================

/**
 * FallbackPlaceholder - Shows when image fails to load
 *
 * Features:
 * - Platform badge (Instagram, TikTok, YouTube)
 * - User initial avatar
 * - Contextual message
 * - Matches existing design system
 */
export const FallbackPlaceholder = ({
  handle = 'user',
  platform = 'creator',
  message = 'Preview unavailable',
  className = ''
}) => {
  const initial = (handle || 'U').charAt(0).toUpperCase();

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 ${className}`}
    >
      {/* Platform badge */}
      <span className="rounded-full bg-zinc-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
        {platform}
      </span>

      {/* User initial avatar */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/20 text-lg font-semibold text-pink-300">
        {initial}
      </div>

      {/* Message */}
      <span className="text-center px-2 text-xs text-zinc-500">
        {message}
      </span>
    </div>
  );
};

// ============================================================================
// 2. useImageFallback HOOK
// ============================================================================

/**
 * useImageFallback - Track failed images and provide fallback logic
 *
 * Usage:
 *   const { failedImageIds, handleImageError, hasImageFailed } = useImageFallback();
 *
 *   <img
 *     src={url}
 *     onError={() => handleImageError(imageId)}
 *   />
 *
 *   {hasImageFailed(imageId) && <FallbackPlaceholder />}
 */
export const useImageFallback = () => {
  const [failedImageIds, setFailedImageIds] = useState(new Set());

  const handleImageError = useCallback((imageId) => {
    setFailedImageIds(prev => {
      const next = new Set(prev);
      next.add(imageId);
      return next;
    });
  }, []);

  const hasImageFailed = useCallback((imageId) => {
    return failedImageIds.has(imageId);
  }, [failedImageIds]);

  const resetImageError = useCallback((imageId) => {
    setFailedImageIds(prev => {
      const next = new Set(prev);
      next.delete(imageId);
      return next;
    });
  }, []);

  const resetAllErrors = useCallback(() => {
    setFailedImageIds(new Set());
  }, []);

  return {
    failedImageIds,
    handleImageError,
    hasImageFailed,
    resetImageError,
    resetAllErrors
  };
};

// ============================================================================
// 3. SmartImage COMPONENT (All-in-one solution)
// ============================================================================

/**
 * SmartImage - Image component with built-in fallback handling
 *
 * Features:
 * - Automatic fallback on error
 * - Loading state
 * - Retry capability
 * - Consistent styling
 */
export const SmartImage = ({
  src,
  alt,
  handle,
  platform,
  className = '',
  fallbackMessage = 'Failed to load',
  noImageMessage = 'No preview',
  onLoad,
  onError
}) => {
  const [status, setStatus] = useState(src ? 'loading' : 'no-image');

  const handleLoad = useCallback((e) => {
    setStatus('loaded');
    onLoad?.(e);
  }, [onLoad]);

  const handleError = useCallback((e) => {
    setStatus('error');
    onError?.(e);
  }, [onError]);

  const handleRetry = useCallback(() => {
    if (src) {
      setStatus('loading');
      // Force re-render by appending timestamp
      // This is handled by parent re-rendering
    }
  }, [src]);

  // No image URL provided
  if (status === 'no-image' || !src) {
    return (
      <FallbackPlaceholder
        handle={handle}
        platform={platform}
        message={noImageMessage}
        className={className}
      />
    );
  }

  // Image failed to load
  if (status === 'error') {
    return (
      <div className={`relative ${className}`}>
        <FallbackPlaceholder
          handle={handle}
          platform={platform}
          message={fallbackMessage}
        />
        {/* Optional retry button */}
        <button
          onClick={handleRetry}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-pink-400 hover:text-pink-300"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading or loaded state - show image
  return (
    <img
      src={src}
      alt={alt || handle || 'Image'}
      className={`h-full w-full object-cover ${className}`}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

// ============================================================================
// 4. INTEGRATION EXAMPLE - Gallery Card
// ============================================================================

/**
 * Example of how to integrate with existing GalleryCard
 */
export const GalleryCardExample = ({
  id,
  previewUrl,
  handle,
  platform,
  displayName,
  isYouTube
}) => {
  // Use the hook at the parent level (SearchResults component)
  // const { failedImageIds, handleImageError } = useImageFallback();

  // For this example, using local state
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative w-full overflow-hidden bg-zinc-800/70 rounded-xl">
      {/* Image container with aspect ratio */}
      <div className={isYouTube ? "aspect-video" : "aspect-[9/16]"}>
        {(!previewUrl || failed) ? (
          <FallbackPlaceholder
            handle={handle}
            platform={platform}
            message={previewUrl ? "Failed to load" : "No preview"}
          />
        ) : (
          <img
            src={previewUrl}
            alt={displayName || handle}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </div>

      {/* Overlay gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/0" />

      {/* Handle badge */}
      <div className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-100 shadow">
        @{handle}
      </div>
    </div>
  );
};

// ============================================================================
// 5. INTEGRATION INSTRUCTIONS
// ============================================================================

/**
 * HOW TO INTEGRATE INTO PRODUCTION:
 *
 * Step 1: Add the hook to SearchResults component
 * ─────────────────────────────────────────────────
 * // Near other useState declarations (~line 557)
 * const [failedImageIds, setFailedImageIds] = useState(new Set());
 *
 * // Replace the existing handleImageError function (~line 1478)
 * const handleImageError = useCallback((imageId) => {
 *   setFailedImageIds(prev => {
 *     const next = new Set(prev);
 *     next.add(imageId);
 *     return next;
 *   });
 * }, []);
 *
 *
 * Step 2: Update the gallery card rendering (~line 2236)
 * ─────────────────────────────────────────────────
 * // Replace this:
 * {previewUrl ? (
 *   <img onError={handleImageError} ... />
 * ) : (
 *   <div>No preview</div>
 * )}
 *
 * // With this:
 * {(!previewUrl || failedImageIds.has(id)) ? (
 *   <FallbackPlaceholder
 *     handle={snapshot.handle}
 *     platform={platformLabel}
 *     message={previewUrl ? "Failed to load" : "No preview"}
 *   />
 * ) : (
 *   <img
 *     onError={() => handleImageError(id)}
 *     ...
 *   />
 * )}
 *
 *
 * Step 3: Also update table view avatar if needed (~line 1830)
 * ─────────────────────────────────────────────────
 * Same pattern - check failedImageIds.has(id) before rendering <img>
 *
 *
 * TESTING:
 * - Open gallery view with creators
 * - Broken CDN images should show fallback instead of blank
 * - Console should not show hidden image errors
 */

export default {
  FallbackPlaceholder,
  useImageFallback,
  SmartImage,
  GalleryCardExample
};
