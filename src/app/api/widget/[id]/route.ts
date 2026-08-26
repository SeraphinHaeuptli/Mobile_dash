import { NextResponse } from 'next/server';
import { runWidget } from '@/lib/registry.server';
import type { WidgetResponse, WidgetSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const fetchedAt = new Date().toISOString();
  let settings: WidgetSettings = {};
  try {
    settings = (await req.json()) as WidgetSettings;
  } catch {
    settings = {};
  }
  try {
    const { data, mode } = await runWidget(params.id, settings ?? {});
    return NextResponse.json<WidgetResponse>({ ok: true, data, mode, fetchedAt });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json<WidgetResponse>({ ok: false, error, mode: 'mock', fetchedAt }, { status: 200 });
  }
}
