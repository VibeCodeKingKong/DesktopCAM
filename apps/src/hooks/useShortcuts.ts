import { useEffect } from 'react';
import { useAppStore, type EditTool } from '../store/useAppStore';
import { createToolpath, deleteSelection, duplicateSelection, exportSelectedGcode, importVectorFile, openProject, redo, saveProject, undo } from '../cam/commands';
import { activeEditor } from '../editing/EditController';

const TOOL_KEYS: Record<string, EditTool> = { v: 'select', n: 'nodes', l: 'line', b: 'curve', r: 'rect', c: 'circle', t: 'text' };

/** Kortkommandon. Visas även i SmartTooltip för respektive knapp. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const s = useAppStore.getState();
      if (s.dialog) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod) {
        const actions: Record<string, () => void> = {
          z: () => (e.shiftKey ? redo() : undo()),
          y: redo,
          e: exportSelectedGcode,
          i: () => void importVectorFile(),
          s: saveProject,
          o: () => void openProject(),
          d: duplicateSelection,
          a: () => s.setSelection(s.layers.filter((l) => l.visible).flatMap((l) => l.shapes.map((x) => x.id))),
        };
        if (actions[key]) {
          e.preventDefault();
          actions[key]();
        }
        return;
      }
      if (e.altKey) return;

      if (key === 'enter' && activeEditor?.drafting) {
        activeEditor.finish(false);
        return;
      }
      if (key === 'escape') {
        if (activeEditor?.drafting) activeEditor.cancelDraft();
        else if (s.editTool !== 'select') s.setEditTool('select');
        else s.clearSelection();
        return;
      }
      if (key === 'backspace' || key === 'delete') {
        e.preventDefault();
        if (activeEditor?.drafting) activeEditor.undoPoint();
        else deleteSelection();
        return;
      }
      if (TOOL_KEYS[key]) {
        s.setEditTool(TOOL_KEYS[key]);
        return;
      }
      switch (key) {
        case 'p': createToolpath('profile'); break;
        case 'f': s.sendViewCommand('fit'); break;
        case '1': s.sendViewCommand('top'); break;
        case '2': s.sendViewCommand('iso'); break;
        case '3': s.sendViewCommand('front'); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
