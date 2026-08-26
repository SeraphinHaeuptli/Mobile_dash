import type { Accent } from '@/design/palette';

import type { ClockSettings } from '../settings';

export interface FaceProps {
  now: Date;
  settings: ClockSettings;
  accent: Accent;
  /**
   * Base numeral size in points. Each face scales its own typography from this
   * single number, so the same face renders identically as a full-screen kiosk
   * and as a thumbnail in the settings picker.
   */
  size: number;
}
