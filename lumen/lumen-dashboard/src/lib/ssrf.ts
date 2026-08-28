import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

/**
 * Guard for connectors that fetch a user-supplied URL (currently: rss.feed).
 * Rejects non-http(s) schemes and any hostname that resolves to a private,
 * loopback or link-local address, so a widget setting can't be used to probe
 * the server's own network (localhost services, cloud metadata endpoints).
 */

const PRIVATE_V4_RANGES: readonly [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ipv4ToInt(base) & mask) === (value & mask);
  });
}

function isPrivateV6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (/^fc[0-9a-f]{2}:|^fd[0-9a-f]{2}:/.test(normalized)) return true; // unique local (fc00::/7)
  // IPv4-mapped IPv6, e.g. ::ffff:169.254.169.254
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateV4(ip);
  if (isIPv6(ip)) return isPrivateV6(ip);
  return true; // unrecognised -> refuse rather than risk it
}

/** Throws if `rawUrl` is not a safe http(s) URL to fetch server-side. Returns the parsed URL otherwise. */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid feed URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported feed protocol: ${url.protocol}`);
  }
  const hostname = url.hostname;
  const literalIp = isIPv4(hostname) || isIPv6(hostname) ? hostname : null;
  const addresses = literalIp
    ? [literalIp]
    : (await lookup(hostname, { all: true })).map((a) => a.address);
  if (!addresses.length) throw new Error('Feed host did not resolve');
  if (addresses.some(isPrivateIp)) throw new Error('Feed URL resolves to a private or local address');
  return url;
}
