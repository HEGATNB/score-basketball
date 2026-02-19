import React, { useEffect, useRef, useState } from 'react';

interface VideoBackgroundProps {
  videoSrc: string;
  overlayOpacity?: number;
  playbackSpeed?: number;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  videoSrc, 
  overlayOpacity = 0.25,
  playbackSpeed = 1.0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.preload = 'auto';
      
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Autoplay prevented:', error);
        });
      }
    }
  }, [playbackSpeed]);

  const handleLoadedData = () => {
    setIsVideoLoaded(true);
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Плейсхолдер */}
      {!isVideoLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950" />
      )}
      
      {/* ВИДЕО НА ВЕСЬ ЭКРАН */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={handleLoadedData}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ 
          filter: 'brightness(0.8) contrast(1.1)',
          opacity: isVideoLoaded ? 1 : 0,
          transition: 'opacity 1s ease'
        }}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      
      {/* Затемнение */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/30" />
    </div>
  );
};