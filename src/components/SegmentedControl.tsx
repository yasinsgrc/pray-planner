import React from 'react';
import { motion } from 'motion/react';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Unique per instance so multiple segmented controls on one screen don't share the sliding highlight. */
  layoutId: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="grid gap-1.5 p-1 rounded-xl bg-paper"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          /* isolate: without it, `relative` alone (no z-index) never forms
             a stacking context, so the pill's -z-10 escaped past this
             button entirely and rendered behind the whole page — the
             selected-option highlight was invisible in every theme
             (design-refresh-v3 Faz 2 F1, found while re-checking contrast
             here: text measured against the *real* rendered pixel showed
             near-zero contrast because there was no gold pixel to sample). */
          className={`relative isolate py-2 px-2 rounded-lg text-xs font-bold text-center transition-colors cursor-pointer before:content-[''] before:absolute before:-top-2 before:-bottom-2 before:-left-0.5 before:-right-0.5 ${
            /* bg-gold pill is bright in both themes (dark-mode --gold is
               brighter still) — a fixed dark ink reads reliably on it,
               unlike text-white which measured 1.87:1-2.19:1 (design-
               refresh-v3 Faz 2 F1: any visible text must clear 4.5:1). */
            value === opt.value ? 'text-[#2D2D2D]' : 'text-ink hover:text-gold-ink'
          }`}
        >
          {value === opt.value && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-gold -z-10"
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
            />
          )}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
