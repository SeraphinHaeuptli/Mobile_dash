import { withAlpha, type Accent } from '@/design/palette';

import type { BackdropId } from './settings';

/** Peak opacity at the centre of a wash, fading to nothing at its edge. */
const GLOW_ALPHA = 0.26;

/**
 * The three backdrops, ported from the app. React Native has no radial gradient
 * primitive, so the app draws the aurora washes in SVG; on the web a CSS
 * `radial-gradient` gives the identical falloff with no element to draw.
 */
export function Backdrop({
  backdrop,
  accent,
}: {
  backdrop: BackdropId;
  accent: Accent;
}) {
  if (backdrop === 'black') {
    return <div className="absolute inset-0 bg-black" />;
  }

  if (backdrop === 'gradient') {
    return (
      <div
        className="absolute inset-0 bg-black"
        style={{
          backgroundImage: `linear-gradient(180deg, ${withAlpha(accent.color, 0.3)} 0%, ${withAlpha(
            accent.companion,
            0.08,
          )} 42%, rgba(0,0,0,0) 100%)`,
        }}
      />
    );
  }

  // Aurora: two washes anchored off-screen so no circular edge is ever visible.
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div
        className="absolute"
        style={{
          width: '170%',
          aspectRatio: '1',
          top: '-24%',
          left: '-50%',
          backgroundImage: `radial-gradient(circle closest-side, ${withAlpha(
            accent.color,
            GLOW_ALPHA,
          )} 0%, ${withAlpha(accent.color, GLOW_ALPHA * 0.4)} 55%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <div
        className="absolute"
        style={{
          width: '150%',
          aspectRatio: '1',
          bottom: '-22%',
          right: '-45%',
          backgroundImage: `radial-gradient(circle closest-side, ${withAlpha(
            accent.companion,
            GLOW_ALPHA,
          )} 0%, ${withAlpha(accent.companion, GLOW_ALPHA * 0.4)} 55%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)',
        }}
      />
    </div>
  );
}
