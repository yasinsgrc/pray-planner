import React from 'react';
import { motion } from 'motion/react';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

/**
 * Reusable view-triggered fade-up reveal (expo-out ease, once per mount).
 * Wraps motion/react so every list/card entrance in the app uses the same
 * timing instead of bespoke inline transitions per component.
 */
export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, y = 20, className }) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};
