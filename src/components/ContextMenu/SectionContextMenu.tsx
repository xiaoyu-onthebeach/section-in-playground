import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { membersOfSection } from '../../lib/membership';
import { RenameIcon, RemoveSectionIcon, ExportIcon, DeleteIcon } from '../Toolbar/icons';
import './ContextMenu.css';

export function SectionContextMenu() {
  const contextMenu = useCanvasStore((s) => s.contextMenu);
  const closeContextMenu = useCanvasStore((s) => s.closeContextMenu);
  const deleteSectionWithContents = useCanvasStore((s) => s.deleteSectionWithContents);
  const dissolveSection = useCanvasStore((s) => s.dissolveSection);
  const duplicateSection = useCanvasStore((s) => s.duplicateSection);
  const copySection = useCanvasStore((s) => s.copySection);
  const bringSectionToFront = useCanvasStore((s) => s.bringSectionToFront);
  const sendSectionToBack = useCanvasStore((s) => s.sendSectionToBack);
  const beginRenameSection = useCanvasStore((s) => s.beginRenameSection);
  const wrapSelectionIntoSection = useCanvasStore((s) => s.wrapSelectionIntoSection);
  const createSceneAt = useCanvasStore((s) => s.createSceneAt);
  const createSectionAt = useCanvasStore((s) => s.createSectionAt);
  const showToast = useCanvasStore((s) => s.showToast);
  const sections = useCanvasStore((s) => s.sections);
  const scenes = useCanvasStore((s) => s.scenes);
  const selectionSectionIds = useCanvasStore((s) => s.selection.sectionIds);

  const [confirm, setConfirm] = useState<{ sectionIds: string[]; count: number } | null>(null);

  if (!contextMenu) return null;

  if (contextMenu.kind === 'canvas') {
    const { world } = contextMenu;
    return (
      <>
        <div className="context-menu-backdrop" onPointerDown={closeContextMenu} />
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            className="context-menu__item"
            onClick={() => {
              createSceneAt(world);
              closeContextMenu();
            }}
          >
            <span className="context-menu__item-content">
              <span className="context-menu__label">Create new scene</span>
            </span>
            <span className="context-menu__shortcut">⌘⇧S</span>
          </button>
          <button
            className="context-menu__item"
            onClick={() => {
              createSectionAt(world);
              closeContextMenu();
            }}
          >
            <span className="context-menu__item-content">
              <span className="context-menu__label">Create new section</span>
            </span>
            <span className="context-menu__shortcut">⌘⌥S</span>
          </button>
        </div>
      </>
    );
  }

  if (contextMenu.kind === 'scene') {
    return (
      <>
        <div className="context-menu-backdrop" onPointerDown={closeContextMenu} />
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            className="context-menu__item"
            onClick={() => {
              wrapSelectionIntoSection();
              closeContextMenu();
            }}
          >
            <span className="context-menu__item-content">
              <span className="context-menu__label">Create new section</span>
            </span>
            <span className="context-menu__shortcut">⌘⌥S</span>
          </button>
        </div>
      </>
    );
  }

  const { sectionId } = contextMenu;
  const section = sections[sectionId];
  if (!section) return null;

  // Right-clicking a section that's part of a multi-selection bulk-acts on
  // the whole selection; right-clicking anything else (SectionView/
  // SectionLabelsLayer already replace the selection in that case) targets
  // just this one.
  const targetIds = selectionSectionIds.includes(sectionId) && selectionSectionIds.length > 1 ? selectionSectionIds : [sectionId];
  const isBulk = targetIds.length > 1;
  const totalMemberCount = targetIds.reduce((sum, id) => sum + membersOfSection(id, scenes).length, 0);

  return (
    <>
      <div className="context-menu-backdrop" onPointerDown={closeContextMenu} />
      <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <button
          className="context-menu__item"
          onClick={() => {
            copySection(targetIds);
            closeContextMenu();
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__label">Copy section</span>
          </span>
          {!isBulk && <span className="context-menu__shortcut">⌘C</span>}
        </button>
        <button
          className="context-menu__item"
          onClick={() => {
            duplicateSection(targetIds);
            closeContextMenu();
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__label">Duplicate section</span>
          </span>
          {!isBulk && <span className="context-menu__shortcut">⌘D</span>}
        </button>
        <button
          className="context-menu__item"
          onClick={() => {
            bringSectionToFront(targetIds);
            closeContextMenu();
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__label">Bring to front</span>
          </span>
          {!isBulk && <span className="context-menu__shortcut">⌘]</span>}
        </button>
        <button
          className="context-menu__item"
          onClick={() => {
            sendSectionToBack(targetIds);
            closeContextMenu();
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__label">Send to back</span>
          </span>
          {!isBulk && <span className="context-menu__shortcut">⌘[</span>}
        </button>
        <div className="context-menu__divider" />
        <button
          className="context-menu__item"
          disabled={isBulk}
          title={isBulk ? 'Select a single section to rename' : undefined}
          onClick={() => {
            beginRenameSection(sectionId);
            closeContextMenu();
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__icon">
              <RenameIcon />
            </span>
            <span className="context-menu__label">Rename section</span>
          </span>
        </button>
        <button
          className="context-menu__item"
          onClick={() => {
            dissolveSection(targetIds);
            closeContextMenu();
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__icon">
              <RemoveSectionIcon />
            </span>
            <span className="context-menu__label">Clear section</span>
          </span>
        </button>
        <div className="context-menu__divider" />
        <button
          className="context-menu__item"
          onClick={() => {
            showToast('Export as PNGs — not implemented in this prototype');
            closeContextMenu();
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__icon">
              <ExportIcon />
            </span>
            <span className="context-menu__label">Export as PNGs</span>
          </span>
        </button>
        <button
          className="context-menu__item context-menu__item--danger"
          onClick={() => {
            if (totalMemberCount > 0) setConfirm({ sectionIds: targetIds, count: totalMemberCount });
            else {
              deleteSectionWithContents(targetIds);
              closeContextMenu();
            }
          }}
        >
          <span className="context-menu__item-content">
            <span className="context-menu__icon">
              <DeleteIcon />
            </span>
            <span className="context-menu__label">Delete</span>
          </span>
        </button>
      </div>
      {confirm && (
        <div className="confirm-backdrop">
          <div className="confirm-dialog">
            <p>
              Delete {confirm.sectionIds.length > 1 ? `${confirm.sectionIds.length} sections` : 'section'} and{' '}
              {confirm.sectionIds.length > 1 ? 'their' : 'its'} {confirm.count} scene{confirm.count === 1 ? '' : 's'}?
            </p>
            <div className="confirm-dialog__actions">
              <button
                className="confirm-dialog__btn"
                onClick={() => {
                  setConfirm(null);
                  closeContextMenu();
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-dialog__btn confirm-dialog__btn--danger"
                onClick={() => {
                  deleteSectionWithContents(confirm.sectionIds);
                  setConfirm(null);
                  closeContextMenu();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
