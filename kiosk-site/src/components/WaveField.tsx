'use client';

import { useEffect, useRef } from 'react';

import { useDemo } from '@/demo/DemoContext';
import { toRgb } from '@/design/palette';
import { createNoise2D, fbm } from '@/lib/perlin';

/** Contour lines drawn across the field. Enough to interleave, few enough to stay cheap. */
const LINES = 34;
/** Horizontal sampling step in CSS pixels. Below ~8px the curve is already smooth. */
const STEP = 6;
/** Noise frequency along x. Sets the wavelength of the swell. */
const SCALE_X = 0.0011;
/** Noise offset between adjacent lines. Larger values decorrelate them faster. */
const SPREAD_Y = 0.09;
/** How far the field drifts per millisecond. */
const SPEED = 0.000045;
/** Wave height as a multiple of the gap between lines — above 1 they interleave. */
const AMPLITUDE = 4.0;
const OCTAVES = 3;
/** Per-frame approach rate when the accent changes, so hues bleed rather than snap. */
const TINT_EASE = 0.06;
/** Retina is worth it for hairlines; beyond 2x is not. */
const MAX_DPR = 2;

type Rgb = [number, number, number];

function lerpRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

/**
 * The animated backdrop: Perlin-displaced contour lines flowing like a slow
 * tide, tinted by whichever accent the demo is set to.
 *
 * Canvas rather than SVG because this is forty re-drawn paths a frame, and
 * additive compositing on true black is what gives the crossings their glow —
 * the same trick the app's aurora backdrop plays with overlapping washes.
 */
export function WaveField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { accent } = useDemo();

  // Read through a ref so a change of accent retints the running animation
  // instead of tearing down and restarting it.
  const targetRef = useRef({ color: accent.color, companion: accent.companion });
  targetRef.current = { color: accent.color, companion: accent.companion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const noise = createNoise2D(20260903);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let tint: Rgb = toRgb(targetRef.current.color);
    let companionTint: Rgb = toRgb(targetRef.current.companion);

    // Arrow consts rather than function declarations: declarations hoist above
    // the null checks above, which throws away the narrowing they establish.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (elapsed: number) => {
      const time = elapsed * SPEED;

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      context.lineWidth = 1.2;

      // Lines start above the top edge and end below the bottom one, so the
      // swell is never cut off by a straight horizontal boundary.
      const top = -height * 0.12;
      const gap = (height * 1.24) / (LINES - 1);
      const amplitude = gap * AMPLITUDE;

      for (let row = 0; row < LINES; row += 1) {
        const depth = row / (LINES - 1);
        // Swell through the middle of the field, flatten and fade at both
        // edges — that is what dissolves it into the black page around it.
        const envelope = Math.sin(Math.PI * depth) ** 1.5;
        if (envelope < 0.01) continue;

        const [r, g, b] = lerpRgb(tint, companionTint, depth);
        context.strokeStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${0.5 * envelope})`;
        context.beginPath();

        const baseY = top + row * gap;
        for (let x = 0; x <= width + STEP; x += STEP) {
          const n = fbm(
            noise,
            x * SCALE_X + time * 0.35,
            row * SPREAD_Y + time,
            OCTAVES,
          );
          const y = baseY + n * amplitude * envelope;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }

        context.stroke();
      }

      context.globalCompositeOperation = 'source-over';
    };

    const step = (timestamp: number) => {
      const target = targetRef.current;
      tint = lerpRgb(tint, toRgb(target.color), TINT_EASE);
      companionTint = lerpRgb(companionTint, toRgb(target.companion), TINT_EASE);

      draw(timestamp);
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (frame || reduced.matches) return;
      frame = requestAnimationFrame(step);
    };

    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    /** A still frame, for reduced motion and for resizes while paused. */
    const still = () => {
      tint = toRgb(targetRef.current.color);
      companionTint = toRgb(targetRef.current.companion);
      draw(0);
    };

    const onVisibility = () => {
      if (document.hidden || !visible) stop();
      else start();
    };

    const onMotionChange = () => {
      if (reduced.matches) {
        stop();
        still();
      } else if (visible && !document.hidden) {
        start();
      }
    };

    resize();
    still();

    const observer = new ResizeObserver(() => {
      resize();
      if (!frame) still();
    });
    observer.observe(canvas);

    // Off-screen or backgrounded, the field is not worth a frame budget.
    const inView = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !document.hidden) start();
        else stop();
      },
      { threshold: 0 },
    );
    inView.observe(canvas);

    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotionChange);

    return () => {
      stop();
      observer.disconnect();
      inView.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
