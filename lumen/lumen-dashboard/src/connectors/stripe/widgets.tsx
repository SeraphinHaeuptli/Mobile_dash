'use client';
import type { WidgetModule, WidgetProps, WidgetMode } from '@/lib/types';
import { Stat, StatGrid, Rows, Row, Pill, Sparkline, Empty, money, relTime } from '@/components/ui';

/* ---------- shapes returned by ./server.ts ---------- */

interface CurrencyBalance {
  currency: string;
  available: number;
  pending: number;
}
interface BalanceData {
  currency: string;
  available: number;
  pending: number;
  others: CurrencyBalance[];
  livemode: boolean;
  updatedAt: string;
}
interface RevenuePoint {
  date: string;
  amount: number;
}
interface RevenueData {
  currency: string;
  days: number;
  total: number;
  previousTotal: number;
  changePct: number | null;
  count: number;
  series: RevenuePoint[];
}
interface Payment {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  created: string;
}
interface PaymentsData {
  charges: Payment[];
}

function SampleHint({ mode }: { mode: WidgetMode }) {
  if (mode === 'live') return <></>;
  return (
    <div className="faint" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 10 }}>
      Sample data
    </div>
  );
}

/* ---------- stripe.balance ---------- */

function Balance({ data, mode }: WidgetProps<BalanceData>) {
  if (!data) return <Empty>No balance available</Empty>;
  const others = data.others ?? [];
  const currency = data.currency ?? 'usd';
  return (
    <div>
      <StatGrid>
        <Stat label={`Available ${currency.toUpperCase()}`} value={money(data.available ?? 0, currency)} tone={(data.available ?? 0) > 0 ? 'good' : undefined} />
        <Stat label="Pending" value={money(data.pending ?? 0, currency)} sub={data.livemode ? 'Live mode' : 'Test mode'} />
      </StatGrid>
      {others.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="stat-label" style={{ marginBottom: 2 }}>Other currencies</div>
          <Rows>
            {others.map((o) => (
              <Row
                key={o.currency}
                title={o.currency.toUpperCase()}
                sub={o.pending > 0 ? `${money(o.pending, o.currency)} pending` : 'nothing pending'}
                right={money(o.available, o.currency)}
              />
            ))}
          </Rows>
        </div>
      )}
      <SampleHint mode={mode} />
    </div>
  );
}

/* ---------- stripe.revenue ---------- */

function Revenue({ data, mode }: WidgetProps<RevenueData>) {
  const series = data?.series ?? [];
  if (!data || series.length === 0) return <Empty>No charges in this period</Empty>;
  const change = data.changePct;
  const tone = change == null ? undefined : change >= 0 ? 'good' : 'bad';
  const changeLabel = change == null ? 'no prior data' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <Stat
        label={`Gross volume · ${data.days}d`}
        value={money(data.total ?? 0, data.currency ?? 'chf')}
        sub={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Pill tone={tone}>{changeLabel}</Pill>
            <span className="faint">vs previous {data.days}d</span>
          </span>
        }
      />
      <div style={{ marginTop: 'auto' }}>
        <Sparkline points={series.map((p) => p.amount)} height={44} tone={tone} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="faint" style={{ fontSize: 11 }}>{series[0]?.date}</span>
          <span className="faint" style={{ fontSize: 11 }}>{data.count} payments</span>
        </div>
      </div>
      <SampleHint mode={mode} />
    </div>
  );
}

/* ---------- stripe.payments ---------- */

function statusTone(status: Payment['status']): 'good' | 'warn' | 'bad' {
  if (status === 'succeeded') return 'good';
  if (status === 'pending') return 'warn';
  return 'bad';
}

function Payments({ data, mode }: WidgetProps<PaymentsData>) {
  const charges = data?.charges ?? [];
  if (charges.length === 0) return <Empty>No recent payments</Empty>;
  return (
    <div>
      <Rows>
        {charges.map((c) => (
          <Row
            key={c.id}
            title={c.name}
            sub={c.description ? `${c.description} · ${relTime(c.created)}` : relTime(c.created)}
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text)' }}>{money(c.amount, c.currency)}</span>
                <Pill tone={statusTone(c.status)}>{c.status}</Pill>
              </div>
            }
          />
        ))}
      </Rows>
      <SampleHint mode={mode} />
    </div>
  );
}

/* ---------- definitions ---------- */

const widgets: WidgetModule[] = [
  {
    def: {
      id: 'stripe.balance',
      connectorId: 'stripe',
      title: 'Stripe balance',
      description: 'Available and pending balance, split by currency.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 300,
      settings: [
        {
          key: 'currency',
          label: 'Headline currency',
          type: 'select',
          default: 'usd',
          options: [
            { label: 'USD', value: 'usd' },
            { label: 'EUR', value: 'eur' },
            { label: 'CHF', value: 'chf' },
            { label: 'GBP', value: 'gbp' },
          ],
          help: 'Other currencies are listed underneath.',
        },
      ],
    },
    Component: Balance as WidgetModule['Component'],
  },
  {
    def: {
      id: 'stripe.revenue',
      connectorId: 'stripe',
      title: 'Stripe revenue',
      description: 'Gross volume over the last N days with trend against the previous period.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 900,
      settings: [
        { key: 'days', label: 'Days', type: 'number', default: 30, placeholder: '30', help: 'Window length, 1–90 days.' },
      ],
    },
    Component: Revenue as WidgetModule['Component'],
  },
  {
    def: {
      id: 'stripe.payments',
      connectorId: 'stripe',
      title: 'Recent payments',
      description: 'Latest charges with amount, status and time.',
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 300,
      settings: [
        { key: 'limit', label: 'Rows', type: 'number', default: 8, placeholder: '8', help: 'How many charges to list, 1–25.' },
      ],
    },
    Component: Payments as WidgetModule['Component'],
  },
];

export default widgets;
