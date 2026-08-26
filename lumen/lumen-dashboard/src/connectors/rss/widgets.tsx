'use client';
import type { WidgetModule, WidgetProps } from '@/lib/types';
import { Empty, Row, Rows, relTime } from '@/components/ui';

/* ---------- shape returned by server.ts ---------- */

interface FeedItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}
interface FeedData {
  title: string;
  url: string;
  items: FeedItem[];
}

function Feed({ data, settings, mode }: WidgetProps<FeedData>) {
  const items = data && Array.isArray(data.items) ? data.items : [];
  if (!items.length) return <Empty>Nothing in this feed yet.</Empty>;
  const showSnippet = settings.showSnippet === true || settings.showSnippet === 'true';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Rows>
        {items.map((item) => (
          <Row
            key={item.id}
            title={
              item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }} title={item.title}>
                  {item.title}
                </a>
              ) : (
                item.title
              )
            }
            sub={
              showSnippet && item.snippet ? (
                <span title={item.snippet}>
                  {item.source} · {item.snippet}
                </span>
              ) : (
                item.source
              )
            }
            right={<span className="faint">{relTime(item.publishedAt)}</span>}
          />
        ))}
      </Rows>
      <div className="faint" style={{ fontSize: 11, marginTop: 'auto', display: 'flex', gap: 6, paddingTop: 6 }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title}</span>
        <span style={{ flex: 1 }} />
        {mode !== 'live' && <span>sample data</span>}
      </div>
    </div>
  );
}

const widgets: WidgetModule[] = [
  {
    def: {
      id: 'rss.feed',
      connectorId: 'rss',
      title: 'Feed',
      description: 'Headlines from any RSS or Atom feed, newest first.',
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 900,
      settings: [
        { key: 'url', label: 'Feed URL', type: 'text', default: 'https://hnrss.org/frontpage', placeholder: 'https://example.com/feed.xml' },
        { key: 'limit', label: 'Headlines', type: 'number', default: 8 },
        { key: 'showSnippet', label: 'Show snippet', type: 'boolean', default: false, help: 'Adds one line of summary under each headline.' },
      ],
    },
    Component: Feed as WidgetModule['Component'],
  },
];

export default widgets;
