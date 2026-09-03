import type { ComponentType } from 'react';

import type { FaceId } from '../settings';
import { AnalogFace } from './AnalogFace';
import { DigitalFace } from './DigitalFace';
import { StackFace } from './StackFace';
import { WordsFace } from './WordsFace';
import type { FaceProps } from './types';

/** The registry, mirroring the app's: adding a face means adding one entry. */
export const FACE_COMPONENTS: Record<FaceId, ComponentType<FaceProps>> = {
  digital: DigitalFace,
  stack: StackFace,
  analog: AnalogFace,
  words: WordsFace,
};

export type { FaceProps };
