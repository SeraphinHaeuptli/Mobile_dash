import type { ComponentType } from 'react';

import type { FaceId } from '../settings';
import { AnalogFace } from './AnalogFace';
import { DigitalFace } from './DigitalFace';
import { StackFace } from './StackFace';
import { WordsFace } from './WordsFace';
import type { FaceProps } from './types';

export interface FaceDefinition {
  id: FaceId;
  name: string;
  Component: ComponentType<FaceProps>;
  /** Numeral size for this face's thumbnail in the picker. */
  previewSize: number;
}

/** Adding a face means adding one entry here and nothing else. */
export const FACES: readonly FaceDefinition[] = [
  { id: 'digital', name: 'Digital', Component: DigitalFace, previewSize: 30 },
  { id: 'stack', name: 'Stack', Component: StackFace, previewSize: 16 },
  { id: 'analog', name: 'Analog', Component: AnalogFace, previewSize: 26 },
  { id: 'words', name: 'Words', Component: WordsFace, previewSize: 26 },
];

export function faceOf(id: FaceId): FaceDefinition {
  return FACES.find((face) => face.id === id) ?? FACES[0];
}

export type { FaceProps };
