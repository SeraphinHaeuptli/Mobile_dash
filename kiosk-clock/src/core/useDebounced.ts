import { useEffect, useState } from 'react';

/**
 * Settles a rapidly changing value.
 *
 * The initial value is used immediately, so first render is not delayed; only
 * subsequent changes wait for the pause. Typing an endpoint into settings would
 * otherwise fire one request per keystroke.
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
