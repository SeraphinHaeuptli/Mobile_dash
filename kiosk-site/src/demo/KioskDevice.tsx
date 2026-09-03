'use client';

import { useMemo } from 'react';

import { longDate } from '@/lib/format';
import { useNow } from '@/lib/useNow';

import { Backdrop } from './Backdrop';
import { UsageMeter } from './UsageMeter';
import { useDemo } from './DemoContext';
import { FACE_COMPONENTS } from './faces';
import { sampleSnapshot } from './usage';

/** The screen, in CSS pixels. A 300 x 640 canvas is a phone at roughly 1:1. */
const SCREEN = { width: 300, height: 640 };

/**
 * One number drives every face's typography, derived from the shorter axis so
 * the face fits in portrait and landscape alike. The app's exact formula.
 */
const FACE_SIZE = Math.min(SCREEN.width * 0.28, SCREEN.height * 0.3);

export function KioskDevice() {
  const { settings, accent } = useDemo();

  // Analog hands and a seconds readout are the only things that move every
  // second; everything else is happy with a minute.
  const now = useNow(
    settings.showSeconds || settings.face === 'analog' ? 'second' : 'minute',
  );

  const snapshot = useMemo(
    () => (now ? sampleSnapshot(now.getTime()) : null),
    [now],
  );

  const Face = FACE_COMPONENTS[settings.face];

  return (
    <div
      className="relative rounded-[46px] bg-gradient-to-b from-white/16 to-white/4 p-[9px] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]"
      style={{ width: SCREEN.width + 18 }}
    >
      <div
        className="relative overflow-hidden rounded-[38px] bg-black"
        style={{ width: SCREEN.width, height: SCREEN.height }}
      >
        <Backdrop backdrop={settings.backdrop} accent={accent} />

        {/* The face only appears once the browser knows the local time, so the
            demo never flashes a server clock from the wrong timezone. */}
        <div className="relative flex h-full flex-col justify-between px-6 pt-10 pb-5">
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            {now && (
              <>
                <Face
                  now={now}
                  settings={settings}
                  accent={accent}
                  size={FACE_SIZE}
                />
                {settings.showDate && (
                  <span className="text-[13px] text-label-secondary">
                    {longDate(now)}
                  </span>
                )}
              </>
            )}
          </div>

          {settings.showUsage && snapshot && now && (
            <UsageMeter
              snapshot={snapshot}
              now={now.getTime()}
              accentColor={accent.color}
            />
          )}
        </div>
      </div>
    </div>
  );
}
