interface VideoBackgroundProps {
  videoSrc?: string;
  fallbackSrc?: string;
  posterSrc?: string;
  overlayOpacity?: number;
  playbackSpeed?: number;
  intensity?: 'subtle' | 'medium' | 'cinematic';
}

/**
 * Legacy no-op for backward compatibility. The new SCORE hero uses a
 * cross-fading photo carousel rendered directly inside the hero component.
 * This wrapper exists so older imports compile without error.
 */
export const VideoBackground = (_props: VideoBackgroundProps) => {
  return null;
};

export default VideoBackground;
