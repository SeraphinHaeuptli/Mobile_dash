import { NextResponse } from 'next/server';
import { readConfig, writeConfig, DEFAULT_CONFIG } from '@/lib/store';
import type { DashboardConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await readConfig());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as DashboardConfig;
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: 'invalid config' }, { status: 400 });
  }
  await writeConfig({ ...DEFAULT_CONFIG, ...body, version: 1 });
  return NextResponse.json({ ok: true });
}

/** Reset to the shipped default layout. */
export async function DELETE() {
  await writeConfig(DEFAULT_CONFIG);
  return NextResponse.json(DEFAULT_CONFIG);
}
