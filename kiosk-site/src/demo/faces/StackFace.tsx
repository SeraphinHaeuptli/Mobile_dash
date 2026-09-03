import { timeParts, tracking } from '@/lib/format';

import { NUMERAL_WEIGHT } from '../settings';
import type { FaceProps } from './types';

const SCALE = 2.3;

/** Hours over minutes at maximum size — readable across a room. */
export function StackFace({ now, settings, accent, size }: FaceProps) {
  const { hours, minutes, suffix } = timeParts(now, settings.hour12);
  const font = size * SCALE;

  const digit: React.CSSProperties = {
    fontSize: font,
    // Leading below 1.0 tightens the two rows into a single visual block.
    lineHeight: 0.92,
    letterSpacing: tracking(font),
    fontWeight: NUMERAL_WEIGHT[settings.weight],
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div className="flex flex-col items-center">
      <span style={{ ...digit, color: 'var(--color-label-primary)' }}>{hours}</span>
      <span style={{ ...digit, color: accent.color }}>{minutes}</span>

      {suffix && (
        <span
          style={{
            fontSize: font * 0.14,
            fontWeight: 600,
            color: 'var(--color-label-tertiary)',
            letterSpacing: 2,
            marginTop: font * 0.06,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
