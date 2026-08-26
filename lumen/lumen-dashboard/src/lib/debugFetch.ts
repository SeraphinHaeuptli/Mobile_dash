import 'server-only';

/**
 * fetch() wrapper used by every connector's live path. When DEBUG_CONNECTORS=1
 * it logs method, url, status and duration for each outbound request to the
 * server console. Headers and bodies are never logged, so auth tokens never
 * reach the log.
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
    console.log(`[connectors] ${method} ${url} -> ERROR (${Date.now() - start}ms): ${reason}`);
    throw e;
  }
}
