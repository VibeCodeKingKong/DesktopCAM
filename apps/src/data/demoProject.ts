import { makeCircle, makeGear, makeRect, uid, type VectorLayer } from '@desktopcam/core';

export function createDemoLayers(): VectorLayer[] {
  return [
    {
      id: uid('layer'),
      name: 'Lager 1',
      color: '#0071e3',
      visible: true,
      locked: false,
      shapes: [
        makeRect('Rektangel', 20, 20, 140, 90),
        makeCircle('Cirkel', 90, 65, 22),
        makeGear('Kugghjul', 225, 70, 48, 40, 16),
      ],
    },
  ];
}
