import 'server-only';

function enabled(): boolean {
  return process.env.DEBUG_CONNECTORS === '1' || process.env.DEBUG_CONNECTORS === 'true';
}

/**
 * fetch() wrapper for connector transports. When DEBUG_CONNECTORS is set, logs
 * one line per outbound request: method, url, status, duration. Never logs
 * headers or body, so API keys and bearer tokens never reach the console.
 */
export async function debugFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!enabled()) return fetch(url, init);
  const method = init?.method ?? 'GET';
  const start = Date.now();
  try {
    const res = await fetch(url, init);
    console.log(`[connectors] ${method} ${url} -> ${res.status} ${Date.now() - start}ms`);
    return res;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`[connectors] ${method} ${url} -> ERROR ${Date.now() - start}ms (${reason})`);
    throw e;
  }
}
