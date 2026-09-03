import type { FaceProps } from './types';

const DIAL_SCALE = 3.0;

/**
 * A minimal dial. SVG rather than the app's stack of rotated views: on the web
 * one transform per element is the honest way to say "this hand points here",
 * and the geometry below is the app's, scaled from `size` the same way.
 */
export function AnalogFace({ now, settings, accent, size }: FaceProps) {
  const dial = size * DIAL_SCALE;
  const centre = dial / 2;

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // The hour hand creeps between markers, and the minute hand between ticks.
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const tickWidth = Math.max(2, dial * 0.012);
  const tickLength = dial * 0.05;
  const tickInset = dial * 0.045;

  function hand(angle: number, length: number, width: number, color: string, tail: number) {
    return (
      <line
        x1={centre}
        y1={centre + tail}
        x2={centre}
        y2={centre - length}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        transform={`rotate(${angle} ${centre} ${centre})`}
      />
    );
  }

  return (
    <svg
      width={dial}
      height={dial}
      viewBox={`0 0 ${dial} ${dial}`}
      role="img"
      aria-label="Analog clock face"
    >
      <circle
        cx={centre}
        cy={centre}
        r={centre - 0.5}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />

      {Array.from({ length: 12 }, (_, index) => (
        <line
          key={index}
          x1={centre}
          y1={tickInset}
          x2={centre}
          y2={tickInset + tickLength}
          // The quarters read as the anchors, the rest as guides.
          stroke={
            index % 3 === 0
              ? 'rgba(235,235,245,0.60)'
              : 'rgba(235,235,245,0.18)'
          }
          strokeWidth={tickWidth}
          strokeLinecap="round"
          transform={`rotate(${index * 30} ${centre} ${centre})`}
        />
      ))}

      {/* Hands overhang the pivot, as real watch hands do. */}
      {hand(hourAngle, dial * 0.27, Math.max(4, dial * 0.028), '#FFFFFF', dial * 0.05)}
      {hand(minuteAngle, dial * 0.39, Math.max(3, dial * 0.021), '#FFFFFF', dial * 0.05)}
      {settings.showSeconds &&
        hand(secondAngle, dial * 0.42, Math.max(1.5, dial * 0.008), accent.color, dial * 0.09)}

      <circle cx={centre} cy={centre} r={Math.max(6, dial * 0.035) / 2} fill={accent.color} />
    </svg>
  );
}
