import { NextResponse } from 'next/server';
import { SERVER_CONNECTORS } from '@/lib/registry.server';

export const dynamic = 'force-dynamic';

/** Which connectors have credentials configured, for the settings panel. */
export async function GET() {
  return NextResponse.json({
    connectors: SERVER_CONNECTORS.map((c) => ({
      id: c.meta.id,
      name: c.meta.name,
      icon: c.meta.icon,
      accent: c.meta.accent,
      envKeys: c.meta.envKeys,
      docsUrl: c.meta.docsUrl ?? null,
      live: c.isLive(),
      missing: c.meta.envKeys.filter((k) => !process.env[k]),
      widgets: Object.keys(c.handlers),
    })),
  });
}
