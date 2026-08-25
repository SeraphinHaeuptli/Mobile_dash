/**
 * Gmail connector — unread count plus the most recent matching threads.
 * Live data: https://gmail.googleapis.com/gmail/v1/users/me/... with an OAuth
 * bearer token in GMAIL_TOKEN.
 */
import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { hasEnv } from '@/lib/env';
import { logFetch, withFallback } from '@/lib/fallback';
import { seeded, intBetween } from '@/lib/mock';

const ENV = ['GMAIL_TOKEN'];
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/* ---------- data shapes (mock and live return exactly these) ---------- */

export interface MailThread {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string; // ISO
  unread: boolean;
}
export interface InboxData {
  unread: number;
  query: string;
  threads: MailThread[];
}

/* ---------- helpers ---------- */

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function asStr(v: unknown, d = ''): string {
  return typeof v === 'string' ? v : d;
}
function asNum(v: unknown, d = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
function setNum(v: unknown, d: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
}
function setStr(v: unknown, d: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : d;
}
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** '"Nadia Keller" <nadia@example.ch>' -> { name, email } */
function parseFrom(raw: string): { name: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim();
    const email = match[2].trim();
    return { name: name || email, email };
  }
  const email = raw.trim();
  return { name: email, email };
}

/* ---------- live API ---------- */

async function gmailGet(path: string): Promise<unknown> {
  const token = process.env.GMAIL_TOKEN ?? '';
  const start = Date.now();
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  logFetch('GET', `${API}/${path}`, res.status, Date.now() - start);
  if (!res.ok) throw new Error(`Gmail ${res.status} on /${path}`);
  return (await res.json()) as unknown;
}

function headerValue(payload: unknown, name: string): string {
  if (!isRec(payload) || !Array.isArray(payload.headers)) return '';
  for (const h of payload.headers) {
    if (isRec(h) && asStr(h.name).toLowerCase() === name.toLowerCase()) return asStr(h.value);
  }
  return '';
}

async function liveInbox(settings: WidgetSettings): Promise<InboxData> {
  const query = setStr(settings.query, 'is:unread in:inbox');
  const limit = setNum(settings.limit, 6, 1, 25);

  const [listBody, labelBody] = await Promise.all([
    gmailGet(`messages?q=${encodeURIComponent(query)}&maxResults=${limit}`),
    gmailGet('labels/UNREAD').catch(() => null),
  ]);

  const ids: string[] = [];
  if (isRec(listBody) && Array.isArray(listBody.messages)) {
    for (const m of listBody.messages) {
      if (isRec(m)) {
        const id = asStr(m.id);
        if (id) ids.push(id);
      }
    }
  }

  const details = await Promise.all(
    ids.map((id) =>
      gmailGet(`messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
    ),
  );

  const threads: MailThread[] = [];
  details.forEach((detail, i) => {
    if (!isRec(detail)) return;
    const from = parseFrom(headerValue(detail.payload, 'From'));
    const internal = Number(asStr(detail.internalDate, ''));
    const headerDate = headerValue(detail.payload, 'Date');
    const when = Number.isFinite(internal) && internal > 0 ? new Date(internal) : new Date(headerDate || Date.now());
    const labels = Array.isArray(detail.labelIds) ? detail.labelIds : [];
    threads.push({
      id: asStr(detail.threadId) || asStr(detail.id) || ids[i],
      from: from.name,
      fromEmail: from.email,
      subject: headerValue(detail.payload, 'Subject') || '(no subject)',
      snippet: asStr(detail.snippet),
      date: when.toISOString(),
      unread: labels.some((l) => asStr(l) === 'UNREAD'),
    });
  });

  threads.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const unread = isRec(labelBody)
    ? asNum(labelBody.messagesUnread, threads.length)
    : asNum(isRec(listBody) ? listBody.resultSizeEstimate : undefined, threads.length);

  return { unread, query, threads };
}

/* ---------- mock ---------- */

const MOCK_MAIL: readonly { from: string; fromEmail: string; subject: string; snippet: string; unread: boolean }[] = [
  {
    from: 'Familie Brunner',
    fromEmail: 'm.brunner@bluewin.ch',
    subject: 'Re: Termin Taufe-Shooting',
    snippet: 'Guten Tag, der Samstag um 14 Uhr passt uns sehr gut. Wir sind zu zwölft, meist draussen im Telli-Park…',
    unread: true,
  },
  {
    from: 'Kantonsschule Aarau',
    fromEmail: 'sekretariat@kanti-aarau.ch',
    subject: 'Maturaarbeit: Abgabe Zwischenbericht',
    snippet: 'Bitte laden Sie den Zwischenbericht bis Freitag 17:00 hoch. Betreuende Lehrperson: Frau Meier…',
    unread: true,
  },
  {
    from: 'Nadia Keller',
    fromEmail: 'nadia.keller@gmx.ch',
    subject: 'Bildauswahl Portraits – Nummern 04, 11, 19',
    snippet: 'Danke für die Galerie! Ich hätte gerne die drei Bilder retuschiert, in hoher Auflösung für LinkedIn…',
    unread: true,
  },
  {
    from: 'FC Aarau Junioren',
    fromEmail: 'nachwuchs@fcaarau-junioren.ch',
    subject: 'Teamfotos Saison 26/27 – Termin fixieren',
    snippet: 'Wir hätten den 6. September ab 10 Uhr auf dem Schachen frei. Bringst du den zweiten Blitz mit?',
    unread: true,
  },
  {
    from: 'Studio Lichtblick GmbH',
    fromEmail: 'offerten@lichtblick-studio.ch',
    subject: 'Offerte Studiomiete Halbtag',
    snippet: 'Wie besprochen: CHF 180 pro Halbtag inkl. Hintergrundsystem, Studentenrabatt bereits abgezogen…',
    unread: true,
  },
  {
    from: 'Lea Frei',
    fromEmail: 'lea.frei@hotmail.com',
    subject: 'Bewerbungsfotos – Rechnung erhalten',
    snippet: 'Alles angekommen, die Zahlung ist raus. Darf ich dich meiner Klasse weiterempfehlen?',
    unread: true,
  },
  {
    from: 'Galaxus',
    fromEmail: 'noreply@galaxus.ch',
    subject: 'Deine Bestellung ist unterwegs',
    snippet: 'Godox AD200 Pro – Lieferung morgen zwischen 08:00 und 12:00 an die Bahnhofstrasse…',
    unread: true,
  },
  {
    from: 'Frau Meier',
    fromEmail: 's.meier@kanti-aarau.ch',
    subject: 'Korrektur Deutschaufsatz',
    snippet: 'Der Aufbau überzeugt, bei den Zitaten fehlen die Seitenangaben. Kurze Besprechung am Donnerstag?',
    unread: true,
  },
  {
    from: 'Weingut Rheinblick',
    fromEmail: 'kontakt@weingut-rheinblick.de',
    subject: 'Sortimentsbilder – Freigabe',
    snippet: 'Die Flaschenaufnahmen sind freigegeben. Rechnung bitte an die Adresse in Waldshut senden…',
    unread: true,
  },
  {
    from: 'Café Kirchplatz',
    fromEmail: 'hallo@cafe-kirchplatz.ch',
    subject: 'Menükarte – neue Bilder?',
    snippet: 'Wir überarbeiten die Karte im Oktober. Hättest du an einem Vormittag zwei Stunden Zeit?',
    unread: true,
  },
  {
    from: 'Swisscom',
    fromEmail: 'rechnung@swisscom.com',
    subject: 'Ihre Rechnung ist bereit',
    snippet: 'Der Betrag wird am 3. des Monats von Ihrem Konto abgebucht. Kein Handlungsbedarf…',
    unread: false,
  },
  {
    from: 'Simon Roth',
    fromEmail: 'simon.roth@turnverein-aarau.ch',
    subject: 'Bildlizenz Vereinsheft',
    snippet: 'Besten Dank, wir verwenden das Bild auf der Titelseite mit deinem Namen im Impressum.',
    unread: false,
  },
];

/** Naive Gmail-style query matching so the `query` setting also bites in mock mode. */
function matchesQuery(mail: MailThread, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${mail.from} ${mail.fromEmail} ${mail.subject} ${mail.snippet}`.toLowerCase();
  for (const token of tokens) {
    if (token === 'is:unread') {
      if (!mail.unread) return false;
    } else if (token === 'is:read') {
      if (mail.unread) return false;
    } else if (token.startsWith('in:') || token.startsWith('label:') || token.startsWith('category:')) {
      continue; // treated as scope, every mock message lives in the inbox
    } else if (token.startsWith('from:')) {
      if (!`${mail.from} ${mail.fromEmail}`.toLowerCase().includes(token.slice(5))) return false;
    } else if (token.startsWith('subject:')) {
      if (!mail.subject.toLowerCase().includes(token.slice(8))) return false;
    } else if (!haystack.includes(token)) {
      return false;
    }
  }
  return true;
}

function mockInbox(settings: WidgetSettings): InboxData {
  const query = setStr(settings.query, 'is:unread in:inbox');
  const limit = setNum(settings.limit, 6, 1, 25);
  const rnd = seeded(`gmail.inbox|${todayKey()}`);

  let minutesAgo = intBetween(rnd, 6, 40);
  const all: MailThread[] = MOCK_MAIL.map((mail, i) => {
    minutesAgo += intBetween(rnd, 25, 320);
    return {
      id: `thr_${String(4820 + i * 13)}`,
      from: mail.from,
      fromEmail: mail.fromEmail,
      subject: mail.subject,
      snippet: mail.snippet,
      date: new Date(Date.now() - minutesAgo * 60000).toISOString(),
      unread: mail.unread,
    };
  });

  const matching = all.filter((m) => matchesQuery(m, query));
  return {
    unread: all.filter((m) => m.unread).length,
    query,
    threads: matching.slice(0, limit),
  };
}

/* ---------- connector ---------- */

const connector: ConnectorServer = {
  meta: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Unread count and the newest threads matching a search.',
    icon: '✉️',
    accent: '#ea4335',
    envKeys: ENV,
    docsUrl: 'https://developers.google.com/gmail/api/reference/rest',
  },
  isLive: () => hasEnv(ENV),
  handlers: {
    'gmail.inbox': (s) => withFallback('gmail.inbox', hasEnv(ENV), () => liveInbox(s), () => mockInbox(s)),
  },
};

export default connector;
