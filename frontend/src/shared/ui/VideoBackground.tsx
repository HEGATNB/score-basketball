import { useEffect, useRef, useState } from 'react';

interface VideoBackgroundProps {
  videoSrc: string;
  fallbackSrc?: string;
  overlayOpacity?: number;
  playbackSpeed?: number;
}

export const VideoBackground = ({
  videoSrc,
  fallbackSrc = '/videos/basketball-bg.mp4',
  overlayOpacity = 0.18,
  playbackSpeed = 1,
}: VideoBackgroundProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = playbackSpeed;
    videoRef.current.play().catch(() => {});
  }, [playbackSpeed]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {!isVideoLoaded && <div className="absolute inset-0 bg-[linear-gradient(180deg,#08111e,#050b14)]" />}

      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedData={() => setIsVideoLoaded(true)}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: isVideoLoaded ? 1 : 0,
          filter: 'blur(0px) saturate(0.92) contrast(1.06) brightness(0.58)',
          transition: 'opacity 900ms ease',
        }}
      >
        <source src={videoSrc} type='video/mp4; codecs="hvc1"' />
        <source src={fallbackSrc} type="video/mp4" />
      </video>

      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.76),rgba(5,7,10,0.26),rgba(5,7,10,0.82))]"
        style={{ opacity: overlayOpacity }}
      />
    </div>
  );
};