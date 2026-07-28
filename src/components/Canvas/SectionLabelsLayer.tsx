import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useSectionRect, useSectionBackground } from '../../hooks/useDerivedState';
import { worldToScreen } from '../../lib/coords';
import { useCanvasOrigin } from '../../canvas/CanvasOriginContext';
import { SectionIcon } from '../Toolbar/icons';
import { CHROME_HIDE_ZOOM_THRESHOLD } from '../../lib/constants';
import type { SectionModel } from '../../types';
import './SectionLabelsLayer.css';

export function SectionLabelsLayer() {
  const sectionOrder = useCanvasStore((s) => s.sectionOrder);
  const sections = useCanvasStore((s) => s.sections);

  return (
    <div className="section-labels-layer">
      {sectionOrder.map((id) => {
        const section = sections[id];
        if (!section) return null;
        return <SectionLabel key={id} section={section} />;
      })}
    </div>
  );
}

function SectionLabel({ section }: { section: SectionModel }) {
  const rect = useSectionRect(section.id, section);
  const viewport = useCanvasStore((s) => s.viewport);
  const isSelected = useCanvasStore((s) => s.selection.sectionIds.includes(section.id));
  const isRenaming = useCanvasStore((s) => s.renamingSectionId === section.id);
  const selectSection = useCanvasStore((s) => s.selectSection);
  const beginRenameSection = useCanvasStore((s) => s.beginRenameSection);
  const commitRenameSection = useCanvasStore((s) => s.commitRenameSection);
  const cancelRenameSection = useCanvasStore((s) => s.cancelRenameSection);
  const openContextMenu = useCanvasStore((s) => s.openSectionContextMenu);
  const startSectionMove = useCanvasStore((s) => s.startSectionMove);
  const updateSectionMove = useCanvasStore((s) => s.updateSectionMove);
  const endSectionMove = useCanvasStore((s) => s.endSectionMove);
  const tool = useCanvasStore((s) => s.tool);
  const sectionIconColor = useCanvasStore((s) => s.debug.sectionIconColor);
  const sectionBackground = useSectionBackground(section.id);
  const { toWorld } = useCanvasOrigin();

  const screenPos = worldToScreen(viewport, { x: rect.x, y: rect.y });
  const maxWidth = Math.max(28, rect.width * viewport.zoom);

  const [draft, setDraft] = useState(section.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setDraft(section.name);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isRenaming, section.name]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isRenaming || e.button !== 0 || tool !== 'select') return;
    e.stopPropagation();
    // A plain click (no shift) on a section that's already part of a
    // multi-selection preserves the whole selection, so dragging from here
    // moves the group; clicking anything else replaces the selection with
    // just this one, same as before.
    const current = useCanvasStore.getState().selection.sectionIds;
    if (e.shiftKey || !(current.includes(section.id) && current.length > 1)) {
      selectSection(section.id, e.shiftKey);
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    startSectionMove(section.id, toWorld(e.clientX, e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    updateSectionMove(toWorld(e.clientX, e.clientY));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    endSectionMove();
  };

  // Too small to read at a very zoomed-out view — hide the chip entirely,
  // unless it's mid-rename (don't yank an open text input from under the user).
  if (viewport.zoom <= CHROME_HIDE_ZOOM_THRESHOLD && !isRenaming) return null;

  return (
    <div
      data-section-name={section.name}
      className={['section-label', isSelected && 'section-label--selected'].filter(Boolean).join(' ')}
      style={{ left: screenPos.x, top: screenPos.y, maxWidth }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        beginRenameSection(section.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Right-clicking a section that's already part of a multi-selection
        // keeps the whole selection intact (so the menu can bulk-act on it);
        // right-clicking anything else replaces the selection with just it.
        if (!useCanvasStore.getState().selection.sectionIds.includes(section.id)) {
          selectSection(section.id, false);
        }
        openContextMenu(e.clientX, e.clientY, section.id);
      }}
      title={section.name.length > 24 ? section.name : undefined}
    >
      <span
        className="section-label__icon"
        style={{ color: isSelected ? undefined : sectionIconColor, ['--section-icon-bg' as string]: sectionBackground }}
      >
        {/* SectionIcon's viewBox was padded (Toolbar.tsx fix) so it matches
            the other toolbar icons' visual weight — that same padding
            shrinks the glyph here too, so the size is bumped up to
            compensate and keep this chip's icon looking the same as before. */}
        <SectionIcon size={21} />
      </span>
      {isRenaming ? (
        <input
          ref={inputRef}
          className="section-label__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRenameSection(section.id, draft);
            else if (e.key === 'Escape') cancelRenameSection();
          }}
          onBlur={() => commitRenameSection(section.id, draft)}
        />
      ) : (
        section.nameTagVisible && (
          <span className="section-label__text">
            {section.name.length > 24 ? `${section.name.slice(0, 24)}…` : section.name}
          </span>
        )
      )}
    </div>
  );
}
