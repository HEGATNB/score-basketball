import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface ParallaxCourtProps {
  className?: string;
}

export const ParallaxCourt: React.FC<ParallaxCourtProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const courtX = useTransform(springX, [-0.5, 0.5], [5, -5]);
  const courtY = useTransform(springY, [-0.5, 0.5], [5, -5]);
  
  const playersX = useTransform(springX, [-0.5, 0.5], [8, -8]);
  const playersY = useTransform(springY, [-0.5, 0.5], [8, -8]);
  
  const ballX = useTransform(springX, [-0.5, 0.5], [12, -12]);
  const ballY = useTransform(springY, [-0.5, 0.5], [12, -12]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const normX = (e.clientX - centerX) / (rect.width / 2);
      const normY = (e.clientY - centerY) / (rect.height / 2);
      
      mouseX.set(Math.max(-0.5, Math.min(0.5, normX)));
      mouseY.set(Math.max(-0.5, Math.min(0.5, normY)));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 1 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          x: courtX,
          y: courtY,
          backgroundImage: 'url("/images/parquet-texture.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.06,
        }}
      />
      
      <motion.div
        className="absolute inset-0"
        style={{
          x: playersX,
          y: playersY,
          backgroundImage: 'url("/images/players-silhouettes.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.03,
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-24 h-24"
        style={{
          x: ballX,
          y: ballY,
        }}
      >
        <div className="w-full h-full bg-orange-500 rounded-full opacity-10 blur-md" />
        <div className="absolute inset-2 bg-orange-500 rounded-full opacity-20" />
        <div className="absolute inset-4 bg-orange-500 rounded-full opacity-30 flex items-center justify-center text-white text-3xl">
          🏀
        </div>
      </motion.div>
    </div>
  );
};