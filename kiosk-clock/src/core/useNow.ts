import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type Tick = 'second' | 'minute';

const INTERVAL: Record<Tick, number> = { second: 1_000, minute: 60_000 };

/**
 * A clock that stays on the beat.
 *
 * A naive setInterval drifts, so each tick is scheduled for the next real
 * boundary instead of a fixed delay. Returning from the background also
 * re-syncs immediately, because timers are throttled while suspended and the
 * displayed time would otherwise be stale for up to a full interval.
 */
export function useNow(tick: Tick = 'second'): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const period = INTERVAL[tick];
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const elapsed = Date.now() % period;
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, period - elapsed);
    };

    schedule();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      clearTimeout(timer);
      setNow(new Date());
      schedule();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [tick]);

  return now;
}
