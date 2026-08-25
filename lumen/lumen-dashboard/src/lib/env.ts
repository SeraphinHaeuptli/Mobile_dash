/** True when every listed env var is set and non-empty (server-side only). */
export function hasEnv(keys: string[]) {
  return keys.length > 0 && keys.every((k) => !!process.env[k] && process.env[k]!.trim() !== '');
}
