import React from 'react';
import { motion } from 'motion/react';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Reusable view-triggered fade reveal (expo-out ease, once per mount).
 * Wraps motion/react so every list/card entrance in the app uses the same
 * timing instead of bespoke inline transitions per component.
 *
 * Opacity-only, no y transform (design-refresh-v3 Faz 24 Commit 1) — a
 * transformed descendant still counts toward the nearest non-overflow:visible
 * ancestor's scrollable region regardless of nesting depth (same mechanism
 * documented at App.tsx's tabpanel), and SpiritualSettings uses this inside
 * <main>: whileInView fires immediately for above-the-fold content on tab
 * mount (not just on a real scroll), so a y offset here was a direct,
 * measured contributor to <main>.scrollHeight transiently exceeding its
 * settled height on tab switches into Ayarlar.
 */
export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, className }) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};
