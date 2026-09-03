'use client';

import { useEffect, useState } from 'react';

export type Tick = 'second' | 'minute';

const INTERVAL: Record<Tick, number> = {
  second: 1_000,
  minute: 60_000,
};

/**
 * The current time, re-rendering on the given cadence.
 *
 * Starts at `null` and fills in after mount: the server has no idea what time
 * it is where the reader is, and rendering a server clock would guarantee a
 * hydration mismatch on every visit.
 */
export function useNow(tick: Tick): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());

    const period = INTERVAL[tick];
    // Align to the boundary so the readout changes when the wall clock does,
    // not a fraction of a second after the page happened to load.
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), period);
      },
      period - (Date.now() % period),
    );

    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, [tick]);

  return now;
}
