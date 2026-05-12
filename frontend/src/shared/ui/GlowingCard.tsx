import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface GlowingCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  glowColor?: 'orange' | 'blue' | 'green' | 'purple';
  delay?: number;
}

const glowStyles = {
  orange: 'border-[rgba(201,106,43,0.16)] shadow-[0_12px_28px_rgba(10,14,20,0.22)]',
  blue: 'border-[rgba(96,125,150,0.16)] shadow-[0_12px_28px_rgba(10,14,20,0.22)]',
  green: 'border-[rgba(114,139,116,0.16)] shadow-[0_12px_28px_rgba(10,14,20,0.22)]',
  purple: 'border-[rgba(141,107,93,0.16)] shadow-[0_12px_28px_rgba(10,14,20,0.22)]',
};

export function GlowingCard({
  children,
  className = '',
  glowColor = 'orange',
  delay = 0,
  ...props
}: GlowingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -1 }}
      className={`group relative overflow-hidden rounded-[18px] border bg-[rgba(8,10,14,0.82)] backdrop-blur-xl ${glowStyles[glowColor]} ${className}`}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,238,0.02),transparent_18%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,248,238,0.1)] to-transparent" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
