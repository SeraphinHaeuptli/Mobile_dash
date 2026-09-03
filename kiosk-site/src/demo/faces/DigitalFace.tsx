import { timeParts, tracking } from '@/lib/format';

import { NUMERAL_WEIGHT } from '../settings';
import type { FaceProps } from './types';

/** Single-line time, the way StandBy shows it: HH:MM with the tint on the digits. */
export function DigitalFace({ now, settings, accent, size }: FaceProps) {
  const { hours, minutes, seconds, suffix } = timeParts(now, settings.hour12);

  const digit: React.CSSProperties = {
    fontSize: size,
    lineHeight: 1.08,
    letterSpacing: tracking(size),
    fontWeight: NUMERAL_WEIGHT[settings.weight],
    color: accent.color,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    // Baseline alignment keeps the seconds and AM/PM on the numerals' feet
    // rather than floating at their vertical centre.
    <div className="flex items-baseline">
      <span style={digit}>{hours}</span>
      {/* Same tint as the digits, stepped back so the pairs stay the focus. */}
      <span style={{ ...digit, opacity: 0.5 }}>:</span>
      <span style={digit}>{minutes}</span>

      {settings.showSeconds && (
        <span
          style={{
            fontSize: size * 0.3,
            fontWeight: NUMERAL_WEIGHT[settings.weight],
            color: 'var(--color-label-secondary)',
            marginLeft: size * 0.08,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {seconds}
        </span>
      )}

      {suffix && (
        <span
          style={{
            fontSize: size * 0.22,
            fontWeight: 600,
            color: 'var(--color-label-tertiary)',
            marginLeft: size * 0.08,
            letterSpacing: 0.5,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
