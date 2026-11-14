/**
 * Vilka verktyg som fungerar för vilken operation. Används både för listan
 * över verktyg och vid beräkningen, så att en bana aldrig räknas med ett
 * verktyg som ger fel resultat (t.ex. en ficka med V-fräs: ringarna läggs ut
 * efter 12,7 mm diameter men fräsen skär bara några mm brett).
 */
import type { ToolKind, ToolpathConfig } from '@desktopcam/core';

export function allowedToolKinds(tp: ToolpathConfig): ToolKind[] {
  switch (tp.operation) {
    case 'profile':
      // V-fräs bara på linjen (gravyr): vid sidan räknas förskjutningen med fel bredd.
      return tp.side === 'on' ? ['endmill', 'ballnose', 'vbit'] : ['endmill', 'ballnose'];
    case 'pocket':
      return ['endmill', 'ballnose'];
    case 'drill':
      return ['drill', 'endmill'];
    case 'facing':
      return ['endmill'];
    case 'vcarve':
    case 'inlay':
      return ['vbit'];
    case 'relief':
      return ['ballnose', 'endmill', 'vbit'];
    case 'laserCut':
    case 'laserRaster':
      return ['laser'];
    case 'plasmaCut':
      return ['plasma'];
  }
}

export const toolFits = (tp: ToolpathConfig, kind: ToolKind | undefined) => !!kind && allowedToolKinds(tp).includes(kind);
