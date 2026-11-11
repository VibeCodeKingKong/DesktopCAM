import { makeCircle, makeGear, makeRect, uid, type VectorLayer } from '@desktopcam/core';
import { DICTS, initialLanguage } from '../i18n';

export function createDemoLayers(): VectorLayer[] {
  const t = DICTS[initialLanguage()];
  return [
    {
      id: uid('layer'),
      name: t.common.layer(1),
      color: '#0071e3',
      visible: true,
      locked: false,
      shapes: [
        makeRect(`${t.shapeNames.rect} 1`, 20, 20, 140, 90),
        makeCircle(`${t.shapeNames.circle} 1`, 90, 65, 22),
        makeGear(`${t.shapeNames.gear} 1`, 225, 70, 48, 40, 16),
      ],
    },
  ];
}
