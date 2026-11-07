import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { addCircle, addRectangle, createToolpath, exportSelectedGcode, importVectorFile } from '../cam/commands';

/** Kortkommandon. Visas även i SmartTooltip för respektive knapp. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const s = useAppStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        exportSelectedGcode();
        return;
      }
      if (mod && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        void importVectorFile();
        return;
      }
      if (mod || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 'r': addRectangle(); break;
        case 'c': addCircle(); break;
        case 'p': createToolpath('profile'); break;
        case 'l': createToolpath('laserCut'); break;
        case 'f': s.sendViewCommand('fit'); break;
        case '1': s.sendViewCommand('top'); break;
        case '2': s.sendViewCommand('iso'); break;
        case '3': s.sendViewCommand('front'); break;
        case 'escape': s.clearSelection(); break;
        case 'delete':
        case 'backspace':
          if (s.selectedToolpathId) s.removeToolpath(s.selectedToolpathId);
          else if (s.selectedReliefId) s.removeRelief(s.selectedReliefId);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
