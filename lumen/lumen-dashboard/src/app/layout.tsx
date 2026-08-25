import './globals.css';
import type { Metadata } from 'next';
import { readConfig } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Lumen Dashboard',
  description: 'A local, fully customizable dashboard with pluggable service connectors.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await readConfig();
  return (
    <html lang="en" data-theme={config.theme} style={{ ['--accent' as string]: config.accent }}>
      <body>{children}</body>
    </html>
  );
}
