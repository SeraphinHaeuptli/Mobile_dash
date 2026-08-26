import net from 'node:net';
import dns from 'node:dns/promises';
import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { debugFetch, withFallback } from '@/lib/fallback';
import { cacheKey } from '@/lib/cache';
import { seeded, intBetween, pick, minutesFromNow } from '@/lib/mock';

/** No credentials needed — this connector just fetches and parses a feed url. */
const ENV: string[] = [];
const CACHE_TTL_SECONDS = 300;

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}
export interface FeedData {
  title: string;
  url: string;
  items: FeedItem[];
}

/* ---------- settings ---------- */

function textSetting(s: WidgetSettings, key: string, fallback: string) {
  const v = s[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}
function numberSetting(s: WidgetSettings, key: string, fallback: number, min: number, max: number) {
  const v = s[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}
function seedFor(widgetId: string, s: WidgetSettings) {
  const parts = Object.keys(s)
    .sort()
    .map((k) => `${k}=${String(s[k])}`)
    .join('&');
  return `${widgetId}|${parts}|${new Date().toISOString().slice(0, 10)}`;
}

/* ---------- a very small feed parser (RSS 2.0 / RDF / Atom) ---------- */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

function clean(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Feeds often carry escaped markup, so strip-and-decode twice.
  const once = decodeEntities(withoutCdata.replace(/<[^>]*>/g, ' '));
  const twice = decodeEntities(once.replace(/<[^>]*>/g, ' '));
  return twice.replace(/\s+/g, ' ').trim();
}

/** First matching child tag, ignoring any namespace prefix. */
function tag(block: string, name: string): string | null {
  const re = new RegExp(`<(?:[a-z0-9_-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9_-]+:)?${name}\\s*>`, 'i');
  const m = re.exec(block);
  return m ? m[1] : null;
}

function attr(block: string, tagName: string, attribute: string): string | null {
  const re = new RegExp(`<(?:[a-z0-9_-]+:)?${tagName}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  const m = re.exec(block);
  return m ? decodeEntities(m[1]) : null;
}

function blocks(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[a-z0-9_-]+:)?${name}(?:\\s[^>]*)?>[\\s\\S]*?</(?:[a-z0-9_-]+:)?${name}\\s*>`, 'gi');
  return xml.match(re) ?? [];
}

function linkOf(block: string): string {
  const plain = tag(block, 'link');
  if (plain) {
    const value = clean(plain);
    if (value) return value;
  }
  // Atom: <link rel="alternate" href="…"/>
  const alternates = block.match(/<(?:[a-z0-9_-]+:)?link\b[^>]*>/gi) ?? [];
  for (const candidate of alternates) {
    if (/rel\s*=\s*["']?(self|replies|edit|enclosure)/i.test(candidate)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(candidate);
    if (href) return decodeEntities(href[1]);
  }
  return attr(block, 'guid', 'isPermaLink') === 'true' ? clean(tag(block, 'guid') ?? '') : '';
}

function dateOf(block: string): string {
  const raw = tag(block, 'pubDate') ?? tag(block, 'published') ?? tag(block, 'updated') ?? tag(block, 'date') ?? '';
  const parsed = new Date(clean(raw));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function parseFeed(xml: string, url: string, limit: number): FeedData {
  const entries = [...blocks(xml, 'item'), ...blocks(xml, 'entry')];
  const head = xml.slice(0, entries.length ? xml.indexOf(entries[0]) : xml.length);
  const feedTitle = clean(tag(head, 'title') ?? '') || hostOf(url) || 'Feed';

  const items: FeedItem[] = entries.slice(0, limit).map((block, i) => {
    const link = linkOf(block);
    const body = tag(block, 'description') ?? tag(block, 'summary') ?? tag(block, 'content') ?? '';
    const text = clean(body);
    const snippet = text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text;
    const itemSource = clean(tag(block, 'source') ?? '') || clean(tag(block, 'creator') ?? '');
    return {
      id: clean(tag(block, 'guid') ?? tag(block, 'id') ?? '') || link || `item-${i}`,
      title: clean(tag(block, 'title') ?? '') || '(untitled)',
      link,
      source: itemSource || hostOf(link) || feedTitle,
      publishedAt: dateOf(block),
      snippet,
    };
  });

  return { title: feedTitle, url, items };
}

/* ---------- SSRF guard ----------
 * The feed url is user input. Reject anything that isn't a plain http(s) url,
 * and reject any hostname that resolves to a private/internal address — most
 * importantly 169.254.169.254, the cloud metadata endpoint. The DNS lookup
 * happens once, right before the fetch it gates; it does not stop a hostname
 * from being re-resolved to a different address between the check and the
 * fetch (DNS rebinding), which would need pinning the fetch to the checked
 * address — out of scope for what PLAN.md Phase 1 asks for here.
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16, incl. cloud metadata
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === '::1' || norm === '::') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(norm);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not a recognisable literal -> treat as unsafe
}

/**
 * Throws when `url` is not a fetchable public http(s) address. Never falls back
 * to mock. Exported for unit tests (PLAN.md Phase 6).
 */
export async function assertPublicFeedUrl(url: string): Promise<URL> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Unsupported feed protocol');
  // URL.hostname keeps the brackets on an IPv6 literal ("[::1]"), which net.isIP
  // does not recognise — without stripping them an IPv6 literal would skip the
  // literal check entirely and fall through to the DNS branch.
  const hostname = parsed.hostname.replace(/^\[(.+)\]$/, '$1');
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error(`Feed host is a private address (${hostname})`);
    return parsed;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error('Feed host did not resolve');
  const bad = records.find((r) => isPrivateAddress(r.address));
  if (bad) throw new Error(`Feed host resolves to a private address (${bad.address})`);
  return parsed;
}

/* ---------- live ---------- */

async function liveFeed(parsed: URL, limit: number): Promise<FeedData> {
  const url = parsed.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await debugFetch('rss', parsed.toString(), {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'User-Agent': 'lumen-dashboard',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Feed ${res.status}`);
    const xml = await res.text();
    const data = parseFeed(xml, url, limit);
    if (!data.items.length) throw new Error('Feed contained no items');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- mock ---------- */

interface Headline {
  title: string;
  source: string;
  snippet: string;
}

const HEADLINES: readonly Headline[] = [
  { title: 'Show HN: I turned an old e-ink reader into a train departure board', source: 'news.ycombinator.com', snippet: 'Runs off a Pi Zero, refreshes every 90 seconds and reads the GTFS feed directly.' },
  { title: 'Fine-tuning a small vision model on a single 8 GB GPU', source: 'news.ycombinator.com', snippet: 'Gradient checkpointing plus 8-bit optimisers gets a 3070 through a run overnight.' },
  { title: 'ETH Zurich opens its lecture recordings to the public', source: 'ethz.ch', snippet: 'Full first-year mathematics and physics series, with exercise sheets.' },
  { title: 'Why film scanners still beat phone apps for negatives', source: 'petapixel.com', snippet: 'Dynamic range, colour inversion and why the orange mask is so hard to remove.' },
  { title: 'Rust 1.9x lands faster incremental builds', source: 'blog.rust-lang.org', snippet: 'Median rebuild times drop noticeably on large workspaces.' },
  { title: 'A practical guide to running Tailscale on a home server', source: 'news.ycombinator.com', snippet: 'Subnet routes, exit nodes and keeping the NAS off the public internet.' },
  { title: 'SBB publishes a new real-time API for regional lines', source: 'opentransportdata.swiss', snippet: 'Delay data now arrives in under ten seconds for most connections.' },
  { title: 'Ask HN: How did you prepare for a maths-heavy first semester?', source: 'news.ycombinator.com', snippet: 'Answers converge on doing every exercise sheet twice, not on reading ahead.' },
  { title: 'Undervolting an RTX 3070 for a quiet homelab', source: 'level1techs.com', snippet: 'Nearly the same throughput at 60 watts less, and the fans stop at night.' },
  { title: 'The case for keeping a plain-text photography log', source: 'lensrentals.com', snippet: 'Shot notes age better than any catalogue database.' },
  { title: 'Writing a tiny XML parser is easier than you think', source: 'news.ycombinator.com', snippet: 'Two regexes and a stack cover most real-world feeds.' },
  { title: 'Swiss high schools trial CS as a mandatory subject', source: 'nzz.ch', snippet: 'Cantons differ on how much of the curriculum is programming.' },
];

function mockFeed(seed: string, url: string, limit: number): FeedData {
  const rnd = seeded(seed);
  const pool = [...HEADLINES];
  const items: FeedItem[] = [];
  let minutes = -intBetween(rnd, 5, 30);
  for (let i = 0; i < limit && pool.length; i++) {
    const chosen = pick(rnd, pool);
    pool.splice(pool.indexOf(chosen), 1);
    items.push({
      id: `mock-${i}`,
      title: chosen.title,
      link: `https://${chosen.source}/`,
      source: chosen.source,
      publishedAt: minutesFromNow(minutes),
      snippet: chosen.snippet,
    });
    minutes -= intBetween(rnd, 20, 260);
  }
  let title = 'Hacker News';
  try {
    title = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    title = 'Feed';
  }
  return { title, url, items };
}

/* ---------- connector ---------- */

const connector: ConnectorServer = {
  meta: {
    id: 'rss',
    name: 'RSS',
    description: 'Headlines from any RSS or Atom feed.',
    icon: '📰',
    accent: '#f97316',
    envKeys: ENV,
    docsUrl: 'https://www.rssboard.org/rss-specification',
  },
  isLive: () => true,
  handlers: {
    'rss.feed': async (s) => {
      const url = textSetting(s, 'url', 'https://hnrss.org/frontpage');
      const limit = numberSetting(s, 'limit', 8, 1, 40);
      // A blocked url is a bad setting, not an upstream hiccup: surface it as a
      // real error rather than quietly serving sample headlines for it.
      const parsed = await assertPublicFeedUrl(url);
      return withFallback(
        true,
        () => liveFeed(parsed, limit),
        () => mockFeed(seedFor('rss.feed', s), url, limit),
        'rss.feed',
        { key: cacheKey('rss.feed', s), ttlSeconds: CACHE_TTL_SECONDS },
      );
    },
  },
};

export default connector;
