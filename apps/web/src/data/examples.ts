/**
 * Exempelprojekten i välkomstfönstret. Projekten och bilderna byggs av
 * scripts/build-examples.cjs och ligger i public/examples/<id>.dcam/.webp.
 * Namn och beskrivning finns i ordlistorna under welcome.examples.
 */
import type { MachineKind } from '@desktopcam/core';

export interface ExampleInfo {
  id: 'router-sign' | 'router-inlay' | 'router-relief' | 'router-gears' | 'laser-photo' | 'laser-coaster' | 'plasma-shield' | 'pen-spiral' | 'pen-card';
  kind: MachineKind;
}

export const EXAMPLES: ExampleInfo[] = [
  { id: 'router-sign', kind: 'router' },
  { id: 'router-inlay', kind: 'router' },
  { id: 'router-relief', kind: 'router' },
  { id: 'router-gears', kind: 'router' },
  { id: 'laser-photo', kind: 'laser' },
  { id: 'laser-coaster', kind: 'laser' },
  { id: 'plasma-shield', kind: 'plasma' },
  { id: 'pen-spiral', kind: 'plotter' },
  { id: 'pen-card', kind: 'plotter' },
];

/** Maskinen som väljs när man väljer maskintyp i välkomstfönstret. */
export const DEFAULT_MACHINE: Record<MachineKind, string> = {
  router: 'mpcnc-primo',
  laser: 'creality-falcon2-22w',
  plasma: 'langmuir-crossfire-pro',
  plotter: 'mpcnc-primo-pen',
};

export const exampleUrl = (id: string, ext: 'dcam' | 'webp') => `${import.meta.env.BASE_URL}examples/${id}.${ext}`;
