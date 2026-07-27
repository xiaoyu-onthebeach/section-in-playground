import { useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { screenToWorld } from '../lib/coords';

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

/** World point at the center of the visible canvas — used as the drop point for keyboard-triggered create actions, which (unlike their right-click-menu counterparts) have no cursor position to anchor to. */
function canvasCenterWorld() {
  const el = document.querySelector('.canvas-root');
  const rect = el?.getBoundingClientRect();
  const screenCenter = rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const origin = { x: rect?.left ?? 0, y: rect?.top ?? 0 };
  return screenToWorld(useCanvasStore.getState().viewport, screenCenter, origin);
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

      if (mod && e.shiftKey && !e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        store.createSceneAt(canvasCenterWorld());
        return;
      }

      if (mod && e.altKey && !e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        // Matches the "Create new section" copy shown in both the scene
        // right-click menu (wraps the selection) and the empty-canvas menu
        // (drops an empty section at the click point) — same shortcut hint,
        // so it needs to actually do the right thing in both contexts.
        if (store.selection.sceneIds.length > 0) store.wrapSelectionIntoSection();
        else store.createSectionAt(canvasCenterWorld());
        return;
      }

      if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyS') {
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
