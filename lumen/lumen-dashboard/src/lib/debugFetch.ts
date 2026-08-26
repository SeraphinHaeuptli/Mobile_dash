import 'server-only';

/**
 * Drop-in replacement for fetch() used by every connector's transport layer.
 * When DEBUG_CONNECTORS=1, logs method, url, status and duration to the server
 * console. Never logs headers or bodies, so an Authorization bearer token can
 * never end up in the log — only call this with credentials in headers, never
 * in the URL.
 */
export async function debugFetch(url: string, init?: RequestInit): Promise<Response> {
  if (process.env.DEBUG_CONNECTORS !== '1') return fetch(url, init);
  const method = init?.method ?? 'GET';
  const start = Date.now();
  try {
    const res = await fetch(url, init);
    console.log(`[connectors] ${method} ${url} -> ${res.status} (${Date.now() - start}ms)`);
    return res;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`[connectors] ${method} ${url} -> ERROR (${Date.now() - start}ms) ${reason}`);
    throw e;
  }
}
