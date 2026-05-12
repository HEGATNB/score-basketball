import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  fallback = '/images/placeholder.png',
  width,
  height,
  priority = false
}) => {
  const [imageSrc, setImageSrc] = useState<string>(priority ? src : '');
  const [isLoading, setIsLoading] = useState(!priority);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!priority) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImageSrc(src);
        setIsLoading(false);
      };
      img.onerror = () => {
        setError(true);
        setIsLoading(false);
      };
    }
  }, [src, priority]);

  if (isLoading) {
    return (
      <div 
        className={`bg-slate-800 animate-pulse rounded-lg ${className}`}
        style={{ width, height }}
      />
    );
  }

  if (error || !imageSrc) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading="lazy"
      />
    );
  }

  return (
    <motion.img
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      src={imageSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
    />
  );
};