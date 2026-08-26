'use client';
import type { WidgetModule, WidgetProps } from '@/lib/types';
import { Empty, Stat, StatGrid } from '@/components/ui';

/* ---------- shapes returned by server.ts ---------- */

interface HourPoint {
  time: string;
  temp: number;
}
interface CurrentData {
  label: string;
  units: 'celsius' | 'fahrenheit';
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

interface ForecastDay {
  date: string;
  code: number;
  condition: string;
  glyph: string;
  min: number;
  max: number;
  precip: number;
}
interface ForecastData {
  label: string;
  units: 'celsius' | 'fahrenheit';
  tempUnit: string;
  days: ForecastDay[];
}

/* ---------- helpers ---------- */

function hourLabel(iso: string) {
  const d = new Date(iso);
  return `${`${d.getHours()}`.padStart(2, '0')}`;
}
function weekday(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
}

/* ---------- weather.current ---------- */

function Current({ data, mode }: WidgetProps<CurrentData>) {
  if (!data || typeof data.temperature !== 'number') return <Empty>No weather data for this location.</Empty>;
  const hours = Array.isArray(data.hourly) ? data.hourly : [];
  const temps = hours.map((h) => h.temp);
  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 1;
  const span = max - min || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 34, lineHeight: 1, color: 'var(--accent)' }}>{data.glyph}</span>
        <div style={{ minWidth: 0 }}>
          <div className="stat-value">
            {data.temperature}
            {data.tempUnit}
          </div>
          <div className="stat-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.condition} · {data.label}
          </div>
        </div>
      </div>

      <StatGrid>
        <Stat label="Feels like" value={`${data.apparent}${data.tempUnit}`} />
        <Stat label="Wind" value={`${data.wind}`} sub={data.windUnit} />
        <Stat label="Humidity" value={`${data.humidity}%`} />
      </StatGrid>

      {hours.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {hours.map((h) => (
            <div key={h.time} style={{ flex: '0 0 30px', textAlign: 'center' }} title={`${h.temp}${data.tempUnit}`}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{h.temp}</div>
              <div style={{ height: 34, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginTop: 3 }}>
                <span
                  style={{
                    width: 6,
                    borderRadius: 999,
                    background: 'var(--accent)',
                    opacity: 0.35 + ((h.temp - min) / span) * 0.65,
                    height: `${20 + ((h.temp - min) / span) * 80}%`,
                  }}
                />
              </div>
              <div className="faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                {hourLabel(h.time)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="faint" style={{ fontSize: 11, marginTop: 'auto', textAlign: 'right' }}>
        {mode === 'mock' ? 'sample data' : 'Open-Meteo'}
      </div>
    </div>
  );
}

/* ---------- weather.forecast ---------- */

function Forecast({ data, mode }: WidgetProps<ForecastData>) {
  const days = data && Array.isArray(data.days) ? data.days : [];
  if (!days.length) return <Empty>No forecast available for this location.</Empty>;
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = hi - lo || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <div className="rows">
        {days.map((d) => (
          <div key={d.date} className="row">
            <span style={{ flex: 'none', width: 42, fontSize: 12.5, color: 'var(--text-dim)' }}>{weekday(d.date)}</span>
            <span style={{ flex: 'none', width: 18, textAlign: 'center' }} title={d.condition}>
              {d.glyph}
            </span>
            <span className="faint" style={{ flex: 'none', width: 30, fontSize: 11.5, textAlign: 'right' }}>
              {d.min}°
            </span>
            <div className="bar" style={{ flex: 1, minWidth: 30, position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: `${((d.min - lo) / span) * 100}%`,
                  width: `${Math.max(6, ((d.max - d.min) / span) * 100)}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            <span style={{ flex: 'none', width: 32, fontSize: 12.5, textAlign: 'right' }}>{d.max}°</span>
            <span className="faint" style={{ flex: 'none', width: 36, fontSize: 11, textAlign: 'right' }} title="Chance of precipitation">
              {d.precip}%
            </span>
          </div>
        ))}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 'auto', display: 'flex', gap: 6 }}>
        <span>
          {data.label} · {data.tempUnit}
        </span>
        <span style={{ flex: 1 }} />
        {mode === 'mock' && <span>sample data</span>}
      </div>
    </div>
  );
}

/* ---------- module ---------- */

const place = [
  { key: 'latitude', label: 'Latitude', type: 'number' as const, default: 47.3925 },
  { key: 'longitude', label: 'Longitude', type: 'number' as const, default: 8.0442 },
  { key: 'label', label: 'Place name', type: 'text' as const, default: 'Aarau' },
];

const widgets: WidgetModule[] = [
  {
    def: {
      id: 'weather.current',
      connectorId: 'weather',
      title: 'Weather now',
      description: 'Current temperature, wind, humidity and the next twelve hours.',
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 5 },
      refreshSeconds: 900,
      settings: [
        ...place,
        {
          key: 'units',
          label: 'Units',
          type: 'select',
          default: 'celsius',
          options: [
            { label: 'Celsius', value: 'celsius' },
            { label: 'Fahrenheit', value: 'fahrenheit' },
          ],
        },
      ],
    },
    Component: Current as WidgetModule['Component'],
  },
  {
    def: {
      id: 'weather.forecast',
      connectorId: 'weather',
      title: 'Forecast',
      description: 'Daily high and low range with chance of precipitation.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 1800,
      settings: [
        ...place,
        {
          key: 'units',
          label: 'Units',
          type: 'select',
          default: 'celsius',
          options: [
            { label: 'Celsius', value: 'celsius' },
            { label: 'Fahrenheit', value: 'fahrenheit' },
          ],
        },
        { key: 'days', label: 'Days', type: 'number', default: 5, help: '1 to 10 days ahead.' },
      ],
    },
    Component: Forecast as WidgetModule['Component'],
  },
];

export default widgets;
