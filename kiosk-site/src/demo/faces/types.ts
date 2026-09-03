import type { Accent } from '@/design/palette';

import type { DemoSettings } from '../settings';

export interface FaceProps {
  now: Date;
  settings: DemoSettings;
  accent: Accent;
  /**
   * Base numeral size in pixels. Each face scales its own typography from this
   * one number, exactly as in the app, so a face renders identically at device
   * size and as a thumbnail.
   */
  size: number;
}
