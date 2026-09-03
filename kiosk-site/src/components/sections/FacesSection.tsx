'use client';

import { Backdrop } from '@/demo/Backdrop';
import { useDemo } from '@/demo/DemoContext';
import { FACE_COMPONENTS } from '@/demo/faces';
import { FACES } from '@/demo/settings';
import { useNow } from '@/lib/useNow';

import { Section } from './Section';

/** Small enough for four across, large enough that the Words face stays legible. */
const PREVIEW_SIZE = 40;

/**
 * Every preview is the real face component at a smaller `size` — the same
 * trick the app's own settings picker plays. Nothing here is a screenshot, so
 * the gallery cannot drift out of date with the product.
 */
export function FacesSection() {
  const { settings, accent, set } = useDemo();
  const now = useNow('second');

  return (
    <Section
      id="faces"
      eyebrow="Four faces"
      title="One clock, four ways to read it."
      lede="Each face is a single component that scales from one number, so it looks the same on a phone in a dock as it does in the preview below. Pick one and the demo at the top of the page follows."
    >
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {FACES.map((face) => {
          const Face = FACE_COMPONENTS[face.id];
          const selected = settings.face === face.id;

          return (
            <button
              key={face.id}
              type="button"
              onClick={() => set('face', face.id)}
              aria-pressed={selected}
              className="group flex flex-col gap-4 text-left"
            >
              <div
                className="relative aspect-[4/5] overflow-hidden rounded-2xl transition-shadow"
                style={{
                  boxShadow: selected
                    ? `0 0 0 1px ${accent.color}`
                    : '0 0 0 1px rgba(255,255,255,0.08)',
                }}
              >
                <Backdrop backdrop="aurora" accent={accent} />
                <div className="relative grid h-full place-items-center p-4">
                  {now && (
                    <Face
                      now={now}
                      settings={{ ...settings, face: face.id }}
                      accent={accent}
                      size={PREVIEW_SIZE}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  {face.name}
                  {selected && (
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: accent.color }}
                    >
                      Selected
                    </span>
                  )}
                </span>
                <span className="text-[13px] leading-snug text-label-tertiary">
                  {face.note}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
