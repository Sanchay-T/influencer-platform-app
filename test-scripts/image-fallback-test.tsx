/**
 * Image Fallback Test - Comparing Current vs Proposed Behavior
 *
 * PROBLEM:
 * Current handleImageError() hides the image on error:
 *   img.style.display = "none"
 * This leaves BLANK SPACE in gallery cards when images fail to load.
 *
 * SOLUTION:
 * Track failed images in state and render fallback UI instead of hiding.
 */

import React, { useState, useCallback } from 'react';

// =============================================================================
// CURRENT BEHAVIOR (BROKEN)
// =============================================================================

/**
 * Current implementation - just hides the image
 * Result: Blank space when image fails
 */
const CurrentImageHandler = {
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    if (img) {
      img.style.display = "none"; // ❌ Hides image, shows nothing
    }
  }
};

/**
 * Current Gallery Card - leaves blank space on error
 */
const CurrentGalleryCard = ({ previewUrl, handle, platform }: {
  previewUrl: string | null;
  handle: string;
  platform: string;
}) => {
  return (
    <div className="relative w-full overflow-hidden bg-zinc-800/70 aspect-[9/16]">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={handle}
          className="h-full w-full object-cover"
          onError={CurrentImageHandler.handleImageError}
        />
        // ❌ When image fails: img hidden, container shows gray background only
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-500">
          No preview available
        </div>
      )}
    </div>
  );
};


// =============================================================================
// PROPOSED FIX
// =============================================================================

/**
 * New hook to track failed images
 * Uses a Set for O(1) lookup performance
 */
const useImageFallback = () => {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((imageKey: string) => {
    setFailedImages(prev => {
      const next = new Set(prev);
      next.add(imageKey);
      return next;
    });
  }, []);

  const hasImageFailed = useCallback((imageKey: string) => {
    return failedImages.has(imageKey);
  }, [failedImages]);

  const resetFailedImage = useCallback((imageKey: string) => {
    setFailedImages(prev => {
      const next = new Set(prev);
      next.delete(imageKey);
      return next;
    });
  }, []);

  return { handleImageError, hasImageFailed, resetFailedImage, failedImages };
};

/**
 * Reusable fallback placeholder component
 */
const ImageFallbackPlaceholder = ({
  handle,
  platform,
  message = "Preview unavailable"
}: {
  handle: string;
  platform: string;
  message?: string;
}) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 text-xs text-zinc-500">
    {/* Platform badge */}
    <span className="rounded-full bg-zinc-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
      {platform}
    </span>
    {/* User initial as avatar fallback */}
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/20 text-lg font-semibold text-pink-300">
      {handle.charAt(0).toUpperCase()}
    </div>
    {/* Message */}
    <span className="text-center px-2">{message}</span>
  </div>
);

/**
 * Fixed Gallery Card - shows fallback on error
 */
const FixedGalleryCard = ({
  previewUrl,
  handle,
  platform,
  hasImageFailed,
  onImageError
}: {
  previewUrl: string | null;
  handle: string;
  platform: string;
  hasImageFailed: boolean;
  onImageError: () => void;
}) => {
  // Show fallback if: no URL, or URL exists but image failed to load
  const showFallback = !previewUrl || hasImageFailed;

  return (
    <div className="relative w-full overflow-hidden bg-zinc-800/70 aspect-[9/16]">
      {showFallback ? (
        // ✅ Shows nice fallback with platform badge and user initial
        <ImageFallbackPlaceholder
          handle={handle}
          platform={platform}
          message={previewUrl ? "Failed to load" : "No preview"}
        />
      ) : (
        <img
          src={previewUrl}
          alt={handle}
          className="h-full w-full object-cover"
          onError={onImageError} // ✅ Triggers state update, re-renders with fallback
        />
      )}
    </div>
  );
};


// =============================================================================
// COMPARISON TEST
// =============================================================================

/**
 * Test component showing side-by-side comparison
 */
export const ImageFallbackComparison = () => {
  const { handleImageError, hasImageFailed } = useImageFallback();

  // Test data: mix of working and broken image URLs
  const testCreators = [
    {
      id: '1',
      handle: 'working_user',
      platform: 'Instagram',
      previewUrl: 'https://via.placeholder.com/300x500' // ✅ Works
    },
    {
      id: '2',
      handle: 'broken_user',
      platform: 'TikTok',
      previewUrl: 'https://broken-cdn.example.com/image.jpg' // ❌ Will fail
    },
    {
      id: '3',
      handle: 'no_preview_user',
      platform: 'YouTube',
      previewUrl: null // No URL at all
    },
    {
      id: '4',
      handle: 'expired_cdn',
      platform: 'Instagram',
      previewUrl: 'https://scontent.cdninstagram.com/expired/image.jpg' // ❌ Expired CDN
    }
  ];

  return (
    <div className="p-8 bg-zinc-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-8">Image Fallback Test</h1>

      <div className="grid grid-cols-2 gap-8">
        {/* Current Behavior */}
        <div>
          <h2 className="text-lg font-semibold text-red-400 mb-4">
            ❌ Current Behavior (Broken)
          </h2>
          <p className="text-sm text-zinc-400 mb-4">
            Failed images are hidden, leaving blank space
          </p>
          <div className="grid grid-cols-2 gap-4">
            {testCreators.map(creator => (
              <CurrentGalleryCard
                key={creator.id}
                previewUrl={creator.previewUrl}
                handle={creator.handle}
                platform={creator.platform}
              />
            ))}
          </div>
        </div>

        {/* Fixed Behavior */}
        <div>
          <h2 className="text-lg font-semibold text-green-400 mb-4">
            ✅ Fixed Behavior (Proposed)
          </h2>
          <p className="text-sm text-zinc-400 mb-4">
            Failed images show nice fallback with platform + initial
          </p>
          <div className="grid grid-cols-2 gap-4">
            {testCreators.map(creator => (
              <FixedGalleryCard
                key={creator.id}
                previewUrl={creator.previewUrl}
                handle={creator.handle}
                platform={creator.platform}
                hasImageFailed={hasImageFailed(creator.id)}
                onImageError={() => handleImageError(creator.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Implementation Notes */}
      <div className="mt-12 p-6 bg-zinc-900 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Implementation Notes</h3>
        <ul className="space-y-2 text-sm text-zinc-300">
          <li>• <code className="text-pink-400">useImageFallback()</code> hook tracks failed images in a Set</li>
          <li>• O(1) lookup for checking if an image has failed</li>
          <li>• Fallback shows platform badge + user initial avatar</li>
          <li>• Distinguishes "No preview" vs "Failed to load" messages</li>
          <li>• No DOM manipulation - pure React state management</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageFallbackComparison;


// =============================================================================
// PRODUCTION-READY IMPLEMENTATION
// =============================================================================

/**
 * This is the actual code to add to search-results.jsx
 *
 * 1. Add this hook near the top of the SearchResults component:
 */
export const productionHook = `
// Add near other useState declarations
const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

// Replace existing handleImageError
const handleImageError = useCallback((imageKey: string) => {
  setFailedImageIds(prev => {
    const next = new Set(prev);
    next.add(imageKey);
    return next;
  });
}, []);

// Helper to check if image failed
const hasImageFailed = useCallback((imageKey: string) => {
  return failedImageIds.has(imageKey);
}, [failedImageIds]);
`;

/**
 * 2. Update the gallery card JSX (around line 2236):
 */
export const productionJSX = `
{/* Replace the existing img/fallback block */}
{(!previewUrl || failedImageIds.has(id)) ? (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 text-xs text-zinc-500">
    <span className="rounded-full bg-zinc-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
      {platformLabel}
    </span>
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/20 text-lg font-semibold text-pink-300">
      {(snapshot.handle || '?').charAt(0).toUpperCase()}
    </div>
    <span>{previewUrl ? "Failed to load" : "No preview"}</span>
  </div>
) : (
  <img
    src={previewUrl}
    alt={snapshot.displayName || snapshot.handle}
    className="h-full w-full object-cover"
    onLoad={(event) => handleImageLoad(event, snapshot.handle)}
    onError={() => handleImageError(id)}
    onLoadStart={(event) => handleImageStart(event, snapshot.handle)}
  />
)}
`;
