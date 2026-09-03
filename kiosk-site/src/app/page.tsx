import { Hero } from '@/components/Hero';
import { DownloadSection } from '@/components/sections/DownloadSection';
import { FacesSection } from '@/components/sections/FacesSection';
import { KioskSection } from '@/components/sections/KioskSection';
import { UsageSection } from '@/components/sections/UsageSection';
import { DemoProvider } from '@/demo/DemoContext';

/**
 * The provider wraps the whole page, not just the hero: choosing a face down in
 * the gallery updates the device at the top, and the accent tints the wave
 * field, the previews and the meter alike.
 */
export default function HomePage() {
  return (
    <DemoProvider>
      <Hero />
      <main id="main">
        <FacesSection />
        <KioskSection />
        <UsageSection />
        <DownloadSection />
      </main>
    </DemoProvider>
  );
}
