import { faceOf, type FaceProps } from './faces';

/** Renders whichever face the settings select. */
export function ClockFace(props: FaceProps) {
  const { Component } = faceOf(props.settings.face);
  return <Component {...props} />;
}
