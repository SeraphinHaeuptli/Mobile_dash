'use client';

import type { ReactNode } from 'react';

/**
 * The site's control primitives, shaped after the app's own iOS-style settings
 * surfaces — a segmented control, an accent swatch row, a switch.
 */

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; name: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-caps">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1 rounded-xl bg-white/6 p-1"
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={`flex-1 rounded-[9px] px-2 py-1.5 text-[13px] font-medium transition-colors ${
                selected
                  ? 'bg-white/14 text-white'
                  : 'text-label-secondary hover:text-white'
              }`}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Switch({
  label,
  checked,
  tint,
  onChange,
}: {
  label: string;
  checked: boolean;
  /** The app tints switches with the accent rather than the iOS system green. */
  tint: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex max-w-60 items-center justify-between gap-3 rounded-lg py-1 text-left"
    >
      <span className="text-[13px] text-label-secondary">{label}</span>
      <span
        aria-hidden="true"
        className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? tint : 'rgba(255,255,255,0.16)' }}
      >
        <span
          className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] ${
            checked ? 'left-[18px]' : 'left-[2px]'
          }`}
        />
      </span>
    </button>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-[22px] border border-glass-line bg-glass p-5 backdrop-blur-xl">
      {children}
    </div>
  );
}
