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
          className={`relative py-2 px-2 rounded-lg text-xs font-bold text-center transition-colors cursor-pointer ${
            value === opt.value ? 'text-white' : 'text-ink hover:text-gold'
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
