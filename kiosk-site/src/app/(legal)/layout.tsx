import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/SiteHeader';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl px-6 pb-24 pt-8">
        {children}
      </main>
    </>
  );
}
