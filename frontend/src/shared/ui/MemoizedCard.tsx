import React, { memo } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  index?: number;
}

export const MemoizedCard = memo(({ children, title, className = '', index = 0 }: CardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 hover:border-orange-500/50 transition-all ${className}`}
    >
      {title && <h3 className="text-lg font-bold text-white mb-4">{title}</h3>}
      {children}
    </motion.div>
  );
});

MemoizedCard.displayName = 'MemoizedCard';