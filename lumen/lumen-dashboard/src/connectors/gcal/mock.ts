/**
 * Deterministic calendar for a Swiss high-school student in Aarau who shoots
 * photography jobs around school. One pool of events feeds both gcal widgets so
 * the agenda and the "next event" tile never disagree.
 */
import { seeded, pick, intBetween } from '@/lib/mock';

export interface MockCalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location: string | null;
}

const SCHOOL = 'Kanti Aarau';

const LESSONS: readonly { title: string; location: string }[] = [
  { title: 'Mathematik Schwerpunkt', location: `${SCHOOL} · Zimmer 214` },
  { title: 'Englisch', location: `${SCHOOL} · Zimmer 106` },
  { title: 'Biologie Praktikum', location: `${SCHOOL} · Labor B2` },
  { title: 'Geschichte', location: `${SCHOOL} · Zimmer 311` },
  { title: 'Chemie', location: `${SCHOOL} · Labor C1` },
  { title: 'Deutsch', location: `${SCHOOL} · Zimmer 208` },
  { title: 'Bildnerisches Gestalten', location: `${SCHOOL} · Atelier 3` },
  { title: 'Sport', location: 'Sporthalle Schachen' },
  { title: 'Maturaarbeit Coaching', location: `${SCHOOL} · Mediothek` },
];

const SHOOTS: readonly { title: string; location: string | null }[] = [
  { title: 'Shooting Familie Brunner', location: 'Telli-Park, Aarau' },
  { title: 'Portraits Nadia Keller', location: 'Altstadt Aarau' },
  { title: 'Teamfotos FC Aarau Junioren', location: 'Sportplatz Schachen' },
  { title: 'Maturaball – Fotostand', location: 'Kultur & Kongresshaus Aarau' },
  { title: 'Produktfotos Velo Huber', location: 'Bahnhofstrasse 12, Aarau' },
  { title: 'Vorbesprechung Hochzeit Meier', location: 'Café Kirchplatz, Aarau' },
  { title: 'Bildbearbeitung & Abgabe', location: null },
  { title: 'Studiotag Atelier Nordlicht', location: 'Buchs AG' },
  { title: 'Shooting Weingut Rheinblick', location: 'Waldshut (DE)' },
];

const ALL_DAY: readonly { title: string; location: string | null }[] = [
  { title: 'Abgabe Maturaarbeit', location: `${SCHOOL} · Sekretariat` },
  { title: 'Sporttag', location: 'Sportplatz Schachen' },
  { title: 'Schulfrei – Brückentag', location: null },
  { title: 'Fotomarkt Zürich', location: 'Zürich' },
];

const SLOTS: readonly (readonly [number, number])[] = [
  [8, 15],
  [10, 5],
  [13, 30],
  [15, 15],
];

function shuffle<T>(rnd: () => number, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Local midnight + hours/minutes, `dayOffset` days from today, as an ISO string. */
function atLocal(dayOffset: number, hours: number, minutes: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** Local YYYY-MM-DD — used to keep the mock stable for a whole day. */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Lesson {
  title: string;
  location: string;
  hour: number;
  minute: number;
}

/** A fixed weekly timetable, so Tuesday looks the same every Tuesday. */
function weeklyTimetable(rnd: () => number): Map<number, Lesson[]> {
  const table = new Map<number, Lesson[]>();
  for (let dow = 1; dow <= 5; dow++) {
    const count = intBetween(rnd, 2, 3);
    const lessons = shuffle(rnd, LESSONS).slice(0, count);
    const slots = shuffle(rnd, SLOTS)
      .slice(0, count)
      .sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
    table.set(
      dow,
      lessons.map((lesson, i) => ({
        title: lesson.title,
        location: lesson.location,
        hour: slots[i][0],
        minute: slots[i][1],
      })),
    );
  }
  return table;
}

/** All events for the next `days` days, sorted by start. */
export function mockCalendar(calendarId: string, days: number): MockCalEvent[] {
  const rnd = seeded(`gcal.events|${todayKey()}|${calendarId}`);
  const timetable = weeklyTimetable(rnd);
  // Each one-off, all-day marker is used at most once across the window.
  const markers = shuffle(rnd, ALL_DAY);
  let markerIndex = 0;
  let lastShoot = '';
  const events: MockCalEvent[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const dow = date.getDay();
    const schoolDay = dow >= 1 && dow <= 5;

    if (rnd() < 0.16 && markerIndex < markers.length) {
      const item = markers[markerIndex++];
      events.push({
        id: `mock-${offset}-allday`,
        title: item.title,
        start: atLocal(offset, 0, 0),
        end: atLocal(offset + 1, 0, 0),
        allDay: true,
        location: item.location,
      });
    }

    for (const [i, lesson] of (timetable.get(dow) ?? []).entries()) {
      const endMinutes = lesson.hour * 60 + lesson.minute + 90;
      events.push({
        id: `mock-${offset}-lesson${i}`,
        title: lesson.title,
        start: atLocal(offset, lesson.hour, lesson.minute),
        end: atLocal(offset, Math.floor(endMinutes / 60), endMinutes % 60),
        allDay: false,
        location: lesson.location,
      });
    }

    if (rnd() < (schoolDay ? 0.5 : 0.85)) {
      let shoot = pick(rnd, SHOOTS);
      if (shoot.title === lastShoot) shoot = pick(rnd, SHOOTS); // no job two days running
      lastShoot = shoot.title;
      const hour = schoolDay ? intBetween(rnd, 17, 19) : intBetween(rnd, 9, 15);
      const minute = pick(rnd, [0, 15, 30]);
      const endMinutes = hour * 60 + minute + intBetween(rnd, 2, 6) * 30;
      events.push({
        id: `mock-${offset}-shoot`,
        title: shoot.title,
        start: atLocal(offset, hour, minute),
        end: atLocal(offset, Math.floor(endMinutes / 60), endMinutes % 60),
        allDay: false,
        location: shoot.location,
      });
    }
  }

  return events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
