'use client';
import type { WidgetModule, WidgetProps, WidgetMode } from '@/lib/types';
import { Stat, Rows, Row, Empty, relTime } from '@/components/ui';

/* ---------- shape returned by ./server.ts ---------- */

interface MailThread {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}
interface InboxData {
  unread: number;
  query: string;
  threads: MailThread[];
}

function SampleHint({ mode }: { mode: WidgetMode }) {
  if (mode === 'live') return <></>;
  return (
    <div className="faint" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 10 }}>
      Sample data
    </div>
  );
}

function Inbox({ data, mode }: WidgetProps<InboxData>) {
  if (!data) return <Empty>No mail to show</Empty>;
  const threads = data?.threads ?? [];
  const unread = data?.unread ?? 0;
  const query = data?.query ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stat
        label="Unread"
        value={unread}
        tone={unread > 0 ? 'warn' : 'good'}
        sub={<span className="faint" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>{query}</span>}
      />
      <div style={{ marginTop: 10, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {threads.length === 0 ? (
          <Empty>Nothing matches this search</Empty>
        ) : (
          <Rows>
            {threads.map((t) => (
              <Row
                key={t.id}
                icon={<span style={{ color: t.unread ? 'var(--accent)' : 'var(--text-faint)' }}>•</span>}
                title={
                  <span style={{ fontWeight: t.unread ? 600 : 400 }}>
                    {t.subject}
                  </span>
                }
                sub={`${t.from} — ${t.snippet}`}
                right={relTime(t.date)}
              />
            ))}
          </Rows>
        )}
      </div>
      <SampleHint mode={mode} />
    </div>
  );
}

const widgets: WidgetModule[] = [
  {
    def: {
      id: 'gmail.inbox',
      connectorId: 'gmail',
      title: 'Inbox',
      description: 'Unread count plus the newest threads matching a Gmail search.',
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 120,
      settings: [
        { key: 'query', label: 'Search', type: 'text', default: 'is:unread in:inbox', placeholder: 'is:unread in:inbox', help: 'Any Gmail search, e.g. "from:kanti-aarau.ch".' },
        { key: 'limit', label: 'Rows', type: 'number', default: 6, placeholder: '6', help: 'How many threads to list, 1–25.' },
      ],
    },
    Component: Inbox as WidgetModule['Component'],
  },
];

export default widgets;
