import { useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

/**
 * Global shortcut handling. Uses e.code (physical key) rather than e.key so
 * Alt-combos (which remap the produced character on many layouts) still match.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const store = useCanvasStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }

      if (mod && e.altKey && e.code === 'KeyG') {
        e.preventDefault();
        if (store.selection.sectionIds.length > 0 && store.selection.sceneIds.length === 0) {
          store.dissolveSection(store.selection.sectionIds);
        } else {
          store.wrapSelectionIntoSection();
        }
        return;
      }

      if (mod && !e.altKey && e.code === 'KeyG') {
        e.preventDefault(); // block the browser's "find next" shortcut
        store.setTool('section');
        return;
      }

      if (mod && !e.altKey && e.code === 'KeyS') {
        e.preventDefault(); // block the browser Save dialog
        if (store.selection.sceneIds.length > 0) store.wrapSelectionIntoSection();
        return;
      }

      if (mod && e.code === 'KeyD') {
        if (store.selection.sectionIds.length > 0) {
          e.preventDefault();
          store.duplicateSection(store.selection.sectionIds);
        }
        return;
      }

      if (mod && e.code === 'KeyC') {
        if (store.selection.sectionIds.length > 0) {
          e.preventDefault();
          store.copySection(store.selection.sectionIds);
        }
        return;
      }

      if (mod && e.code === 'KeyV') {
        e.preventDefault();
        store.pasteSection();
        return;
      }

      if (mod && e.code === 'BracketRight') {
        if (store.selection.sectionIds.length > 0) {
          e.preventDefault();
          store.bringSectionToFront(store.selection.sectionIds);
        }
        return;
      }

      if (mod && e.code === 'BracketLeft') {
        if (store.selection.sectionIds.length > 0) {
          e.preventDefault();
          store.sendSectionToBack(store.selection.sectionIds);
        }
        return;
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (store.selection.sectionIds.length > 0) {
          e.preventDefault();
          store.deleteSectionWithContents(store.selection.sectionIds);
        } else if (store.selection.sceneIds.length > 0) {
          e.preventDefault();
          store.deleteScenes(store.selection.sceneIds);
        }
        return;
      }

      if (e.code === 'Escape') {
        if (store.renamingSectionId) {
          store.cancelRenameSection();
          return;
        }
        if (store.dragState) {
          store.cancelDrag();
          return;
        }
        store.clearSelection();
        return;
      }

      if (!mod && !e.altKey) {
        if (e.code === 'KeyV') {
          store.setTool('select');
          return;
        }
        if (e.code === 'KeyH') {
          store.setTool('pan');
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
