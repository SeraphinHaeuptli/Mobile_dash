import { NextResponse } from 'next/server';
import { runWidget } from '@/lib/registry.server';
import type { WidgetResponse, WidgetSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Next 15+ hands route handlers `params` as a Promise, not a plain object.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const fetchedAt = new Date().toISOString();
  const { id } = await params;
  let settings: WidgetSettings = {};
  try {
    settings = (await req.json()) as WidgetSettings;
  } catch {
    settings = {};
  }
  try {
    const { data, mode, warning } = await runWidget(id, settings ?? {});
    return NextResponse.json<WidgetResponse>({ ok: true, data, mode, warning, fetchedAt });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json<WidgetResponse>({ ok: false, error, mode: 'mock', fetchedAt }, { status: 200 });
  }
}
