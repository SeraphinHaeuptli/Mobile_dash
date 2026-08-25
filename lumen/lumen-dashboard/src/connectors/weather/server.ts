import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { logFetch, withFallback } from '@/lib/fallback';
import { seeded, intBetween, pick } from '@/lib/mock';

/**
 * Open-Meteo needs no API key, so this connector is always live and only falls
 * back to the deterministic sample when the machine has no working network.
 */
const ENV: string[] = [];
const API = 'https://api.open-meteo.com/v1/forecast';

/* ---------- shared shapes ---------- */

export type Units = 'celsius' | 'fahrenheit';

export interface HourPoint {
  time: string;
  temp: number;
}
export interface CurrentData {
  label: string;
  units: Units;
  tempUnit: string;
  windUnit: string;
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  code: number;
  condition: string;
  glyph: string;
  isDay: boolean;
  observedAt: string;
  hourly: HourPoint[];
}

export interface ForecastDay {
  date: string;
  code: number;
  condition: string;
  glyph: string;
  min: number;
  max: number;
  precip: number;
}
export interface ForecastData {
  label: string;
  units: Units;
  tempUnit: string;
  days: ForecastDay[];
}

/* ---------- WMO code table ---------- */

interface Condition {
  text: string;
  day: string;
  night: string;
}

const WMO: Record<number, Condition> = {
  0: { text: 'Clear', day: '☀', night: '☾' },
  1: { text: 'Mainly clear', day: '☀', night: '☾' },
  2: { text: 'Partly cloudy', day: '⛅', night: '☁' },
  3: { text: 'Overcast', day: '☁', night: '☁' },
  45: { text: 'Fog', day: '≡', night: '≡' },
  48: { text: 'Rime fog', day: '≡', night: '≡' },
  51: { text: 'Light drizzle', day: '⛆', night: '⛆' },
  53: { text: 'Drizzle', day: '⛆', night: '⛆' },
  55: { text: 'Heavy drizzle', day: '⛆', night: '⛆' },
  56: { text: 'Freezing drizzle', day: '⛆', night: '⛆' },
  57: { text: 'Freezing drizzle', day: '⛆', night: '⛆' },
  61: { text: 'Light rain', day: '☂', night: '☂' },
  63: { text: 'Rain', day: '☂', night: '☂' },
  65: { text: 'Heavy rain', day: '☂', night: '☂' },
  66: { text: 'Freezing rain', day: '☂', night: '☂' },
  67: { text: 'Freezing rain', day: '☂', night: '☂' },
  71: { text: 'Light snow', day: '❄', night: '❄' },
  73: { text: 'Snow', day: '❄', night: '❄' },
  75: { text: 'Heavy snow', day: '❄', night: '❄' },
  77: { text: 'Snow grains', day: '❄', night: '❄' },
  80: { text: 'Rain showers', day: '☂', night: '☂' },
  81: { text: 'Rain showers', day: '☂', night: '☂' },
  82: { text: 'Violent showers', day: '☂', night: '☂' },
  85: { text: 'Snow showers', day: '❄', night: '❄' },
  86: { text: 'Snow showers', day: '❄', night: '❄' },
  95: { text: 'Thunderstorm', day: '⚡', night: '⚡' },
  96: { text: 'Thunderstorm, hail', day: '⚡', night: '⚡' },
  99: { text: 'Thunderstorm, hail', day: '⚡', night: '⚡' },
};

function describe(code: number, isDay: boolean): { condition: string; glyph: string } {
  const c = WMO[code];
  if (!c) return { condition: 'Unknown', glyph: '·' };
  return { condition: c.text, glyph: isDay ? c.day : c.night };
}

/* ---------- settings ---------- */

interface Place {
  latitude: number;
  longitude: number;
  label: string;
  units: Units;
}

function numberSetting(s: WidgetSettings, key: string, fallback: number) {
  const v = s[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function textSetting(s: WidgetSettings, key: string, fallback: string) {
  const v = s[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}
function placeOf(s: WidgetSettings): Place {
  const units = textSetting(s, 'units', 'celsius') === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  return {
    latitude: Math.max(-90, Math.min(90, numberSetting(s, 'latitude', 47.3925))),
    longitude: Math.max(-180, Math.min(180, numberSetting(s, 'longitude', 8.0442))),
    label: textSetting(s, 'label', 'Aarau'),
    units,
  };
}
function seedFor(widgetId: string, s: WidgetSettings) {
  const parts = Object.keys(s)
    .sort()
    .map((k) => `${k}=${String(s[k])}`)
    .join('&');
  return `${widgetId}|${parts}|${new Date().toISOString().slice(0, 10)}`;
}
function tempUnitOf(units: Units) {
  return units === 'fahrenheit' ? '°F' : '°C';
}
function windUnitOf(units: Units) {
  return units === 'fahrenheit' ? 'mph' : 'km/h';
}

/* ---------- json narrowing ---------- */

function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}
function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/* ---------- transport ---------- */

async function openMeteo(place: Place, extra: Record<string, string>): Promise<unknown> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: 'auto',
    temperature_unit: place.units,
    wind_speed_unit: place.units === 'fahrenheit' ? 'mph' : 'kmh',
    ...extra,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const start = Date.now();
  try {
    const res = await fetch(`${API}?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
    logFetch('GET', `${API}?${params.toString()}`, res.status, Date.now() - start);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- live ---------- */

async function liveCurrent(place: Place): Promise<CurrentData> {
  const raw = await openMeteo(place, {
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    hourly: 'temperature_2m',
    forecast_days: '2',
  });
  const body = rec(raw);
  const current = rec(body.current);
  if (current.temperature_2m === undefined) throw new Error('Open-Meteo returned no current block');

  const code = num(current.weather_code);
  const isDay = num(current.is_day, 1) === 1;
  const { condition, glyph } = describe(code, isDay);
  const observedAt = str(current.time, new Date().toISOString());

  const hourlyBlock = rec(body.hourly);
  const times = list(hourlyBlock.time).map((t) => str(t));
  const temps = list(hourlyBlock.temperature_2m).map((t) => num(t));
  const nowMs = new Date(observedAt).getTime();
  let start = times.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (start < 0) start = 0;
  const hourly: HourPoint[] = times.slice(start, start + 12).map((t, i) => ({ time: t, temp: Math.round(temps[start + i] ?? 0) }));

  return {
    label: place.label,
    units: place.units,
    tempUnit: tempUnitOf(place.units),
    windUnit: windUnitOf(place.units),
    temperature: Math.round(num(current.temperature_2m)),
    apparent: Math.round(num(current.apparent_temperature)),
    humidity: Math.round(num(current.relative_humidity_2m)),
    wind: Math.round(num(current.wind_speed_10m)),
    code,
    condition,
    glyph,
    isDay,
    observedAt,
    hourly,
  };
}

async function liveForecast(place: Place, days: number): Promise<ForecastData> {
  const raw = await openMeteo(place, {
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: String(Math.min(16, Math.max(1, days))),
  });
  const daily = rec(rec(raw).daily);
  const dates = list(daily.time).map((t) => str(t));
  if (!dates.length) throw new Error('Open-Meteo returned no daily block');
  const codes = list(daily.weather_code);
  const maxes = list(daily.temperature_2m_max);
  const mins = list(daily.temperature_2m_min);
  const precip = list(daily.precipitation_probability_max);

  const out: ForecastDay[] = dates.slice(0, days).map((date, i) => {
    const code = num(codes[i]);
    const { condition, glyph } = describe(code, true);
    return {
      date,
      code,
      condition,
      glyph,
      min: Math.round(num(mins[i])),
      max: Math.round(num(maxes[i])),
      precip: Math.round(num(precip[i])),
    };
  });
  return { label: place.label, units: place.units, tempUnit: tempUnitOf(place.units), days: out };
}

/* ---------- mock ---------- */

const MOCK_CODES: readonly number[] = [0, 1, 2, 2, 3, 45, 61, 63, 80, 95, 71];

function toF(c: number) {
  return Math.round(c * 1.8 + 32);
}
function conv(c: number, units: Units) {
  return units === 'fahrenheit' ? toF(c) : Math.round(c);
}

function mockCurrent(seed: string, place: Place): CurrentData {
  const rnd = seeded(seed);
  const now = new Date();
  const hour = now.getHours();
  const isDay = hour >= 7 && hour < 20;
  const code = pick(rnd, MOCK_CODES);
  const { condition, glyph } = describe(code, isDay);
  const baseC = intBetween(rnd, 6, 24);
  const hourly: HourPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const at = new Date(now.getTime() + i * 36e5);
    const swing = Math.sin(((at.getHours() - 4) / 24) * Math.PI * 2) * 4;
    hourly.push({ time: at.toISOString(), temp: conv(baseC + swing + (rnd() - 0.5) * 1.5, place.units) });
  }
  return {
    label: place.label,
    units: place.units,
    tempUnit: tempUnitOf(place.units),
    windUnit: windUnitOf(place.units),
    temperature: conv(baseC, place.units),
    apparent: conv(baseC - 1 + rnd() * 2, place.units),
    humidity: intBetween(rnd, 44, 92),
    wind: intBetween(rnd, 3, 26),
    code,
    condition,
    glyph,
    isDay,
    observedAt: now.toISOString(),
    hourly,
  };
}

function mockForecast(seed: string, place: Place, days: number): ForecastData {
  const rnd = seeded(seed);
  const start = new Date();
  const out: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(start.getTime() + i * 864e5);
    const code = pick(rnd, MOCK_CODES);
    const { condition, glyph } = describe(code, true);
    const maxC = intBetween(rnd, 9, 26);
    const minC = maxC - intBetween(rnd, 4, 11);
    out.push({
      date: at.toISOString().slice(0, 10),
      code,
      condition,
      glyph,
      min: conv(minC, place.units),
      max: conv(maxC, place.units),
      precip: code === 0 || code === 1 ? intBetween(rnd, 0, 10) : intBetween(rnd, 20, 95),
    });
  }
  return { label: place.label, units: place.units, tempUnit: tempUnitOf(place.units), days: out };
}

/* ---------- connector ---------- */

const connector: ConnectorServer = {
  meta: {
    id: 'weather',
    name: 'Weather',
    description: 'Current conditions and a five-day outlook from Open-Meteo. No API key needed.',
    icon: '☀',
    accent: '#38bdf8',
    envKeys: ENV,
    docsUrl: 'https://open-meteo.com/en/docs',
  },
  isLive: () => true,
  handlers: {
    'weather.current': async (s) => {
      const place = placeOf(s);
      return withFallback(
        'weather.current',
        true,
        () => liveCurrent(place),
        () => mockCurrent(seedFor('weather.current', s), place),
      );
    },
    'weather.forecast': async (s) => {
      const place = placeOf(s);
      const days = Math.min(10, Math.max(1, Math.round(numberSetting(s, 'days', 5))));
      return withFallback(
        'weather.forecast',
        true,
        () => liveForecast(place, days),
        () => mockForecast(seedFor('weather.forecast', s), place, days),
      );
    },
  },
};

export default connector;
