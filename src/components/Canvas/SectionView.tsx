import { useCanvasStore } from '../../store/canvasStore';
import type { ResizeHandle, SectionModel } from '../../types';
import { useSectionRect, useDragHighlight, useSectionBackground } from '../../hooks/useDerivedState';
import { useCanvasOrigin } from '../../canvas/CanvasOriginContext';
import './SectionView.css';

interface Props {
  section: SectionModel;
}

// The visible border itself is drawn by SectionBordersLayer (a screen-space
// overlay, immune to the CSS border-width device-pixel snapping that a
// counter-scaled in-world border suffers from) — this component only draws
// the fill and hosts the interactive hit areas (move/resize). Band hit-zone
// thickness still uses the old value/zoom counter-scaling technique since
// only border-*width* rendering has the snapping problem, not element size.
const BAND_THICKNESS = 8;
// Small square hit-zones layered on top of the 4 edge bands at each corner
// (rendered after them in DOM order, so they win the hit-test where an
// n/s band would otherwise overlap a w/e band) — bound to the diagonal
// handle so dragging exactly at a corner resizes both axes, with the
// matching diagonal cursor, even before the section is selected (the
// invisible ResizeHandles dots only exist once selected).
const CORNERS: { handle: ResizeHandle; cursor: string; style: React.CSSProperties }[] = [
  { handle: 'nw', cursor: 'nwse-resize', style: { left: 0, top: 0 } },
  { handle: 'ne', cursor: 'nesw-resize', style: { right: 0, top: 0 } },
  { handle: 'sw', cursor: 'nesw-resize', style: { left: 0, bottom: 0 } },
  { handle: 'se', cursor: 'nwse-resize', style: { right: 0, bottom: 0 } },
];

export function SectionView({ section }: Props) {
  const rect = useSectionRect(section.id, section);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const isMoving = useCanvasStore((s) => s.dragState?.kind === 'section-move' && s.dragState.sectionIds.includes(section.id));
  const isResizing = useCanvasStore((s) => s.dragState?.kind === 'section-resize' && s.dragState.sectionIds.includes(section.id));
  const isGrowing = useCanvasStore((s) => s.growingSectionId === section.id);
  const growDuration = useCanvasStore((s) => s.debug.growDuration);
  const highlight = useDragHighlight();
  const isHighlighted = highlight.sectionId === section.id;
  const backgroundColor = useSectionBackground(section.id);

  const startSectionResize = useCanvasStore((s) => s.startSectionResize);
  const updateSectionResize = useCanvasStore((s) => s.updateSectionResize);
  const endSectionResize = useCanvasStore((s) => s.endSectionResize);
  const startSectionMove = useCanvasStore((s) => s.startSectionMove);
  const updateSectionMove = useCanvasStore((s) => s.updateSectionMove);
  const endSectionMove = useCanvasStore((s) => s.endSectionMove);
  const selectSection = useCanvasStore((s) => s.selectSection);
  const openContextMenu = useCanvasStore((s) => s.openSectionContextMenu);
  const tool = useCanvasStore((s) => s.tool);
  const { toWorld } = useCanvasOrigin();

  // The border band now resizes along that edge (the whole edge is a resize
  // grab, not just the small corner/midpoint handles) — moving a section is
  // done via its label instead.
  // Right-clicking a section that's already part of a multi-selection keeps
  // the whole selection intact (so the menu can bulk-act on it); right-
  // clicking anything else replaces the selection with just this section.
  const selectForContextMenu = () => {
    if (!useCanvasStore.getState().selection.sectionIds.includes(section.id)) {
      selectSection(section.id, false);
    }
  };

  // A plain click (no shift) on a section that's already part of a multi-
  // selection preserves the whole selection, so dragging from here moves/
  // resizes the group; clicking anything else replaces the selection with
  // just this one, same as before.
  const selectForDrag = (shiftKey: boolean) => {
    const current = useCanvasStore.getState().selection.sectionIds;
    if (shiftKey || !(current.includes(section.id) && current.length > 1)) {
      selectSection(section.id, shiftKey);
    }
  };

  const onBandPointerDown = (handle: ResizeHandle) => (e: React.PointerEvent) => {
    if (e.button !== 0 || tool !== 'select') return;
    e.stopPropagation();
    selectForDrag(e.shiftKey);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    startSectionResize(section.id, handle, toWorld(e.clientX, e.clientY));
  };
  const onBandPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    updateSectionResize(toWorld(e.clientX, e.clientY));
  };
  const onBandPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    endSectionResize();
  };
  const onBandContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectForContextMenu();
    openContextMenu(e.clientX, e.clientY, section.id);
  };

  // Clicking anywhere in the section's area (not just the label) selects it;
  // dragging from there moves the whole section + members, same as the
  // label. A plain click (no movement) is a no-op move — endSectionMove
  // no-ops when dx/dy are both zero — so select-vs-drag falls out for free,
  // no threshold needed. Scenes sitting on top are separate elements and
  // still take the click themselves, so this only ever fires on true
  // background.
  const onInteriorPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || tool !== 'select') return;
    e.stopPropagation();
    selectForDrag(e.shiftKey);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    startSectionMove(section.id, toWorld(e.clientX, e.clientY));
  };
  const onInteriorPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    updateSectionMove(toWorld(e.clientX, e.clientY));
  };
  const onInteriorPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    endSectionMove();
  };
  const onInteriorContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectForContextMenu();
    openContextMenu(e.clientX, e.clientY, section.id);
  };

  const bandThickness = BAND_THICKNESS / zoom;

  return (
    <div
      data-section-name={section.name}
      className={['section-box', isMoving && 'section-box--moving'].filter(Boolean).join(' ')}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        // Also animates the LIVE grow/shrink preview while a scene drag is
        // hovering this section (isHighlighted) — not just the post-drop
        // commit (isGrowing) — so crossing the border eases into the grown
        // size instead of popping to it instantly.
        transition: (isGrowing || isHighlighted) && !isMoving && !isResizing ? `left ${growDuration}ms ease-out, top ${growDuration}ms ease-out, width ${growDuration}ms ease-out, height ${growDuration}ms ease-out` : 'none',
      }}
    >
      <div
        className={['section-visual', isHighlighted && 'section-visual--highlight'].filter(Boolean).join(' ')}
        style={{ background: isHighlighted ? undefined : backgroundColor }}
        onPointerDown={onInteriorPointerDown}
        onPointerMove={onInteriorPointerMove}
        onPointerUp={onInteriorPointerUp}
        onContextMenu={onInteriorContextMenu}
      />
      <div className="section-band section-band--n" style={{ height: bandThickness }} onPointerDown={onBandPointerDown('n')} onPointerMove={onBandPointerMove} onPointerUp={onBandPointerUp} onContextMenu={onBandContextMenu} />
      <div className="section-band section-band--s" style={{ height: bandThickness }} onPointerDown={onBandPointerDown('s')} onPointerMove={onBandPointerMove} onPointerUp={onBandPointerUp} onContextMenu={onBandContextMenu} />
      <div className="section-band section-band--w" style={{ width: bandThickness }} onPointerDown={onBandPointerDown('w')} onPointerMove={onBandPointerMove} onPointerUp={onBandPointerUp} onContextMenu={onBandContextMenu} />
      <div className="section-band section-band--e" style={{ width: bandThickness }} onPointerDown={onBandPointerDown('e')} onPointerMove={onBandPointerMove} onPointerUp={onBandPointerUp} onContextMenu={onBandContextMenu} />
      {CORNERS.map((c) => (
        <div
          key={c.handle}
          className="section-corner"
          style={{ ...c.style, cursor: c.cursor, width: bandThickness * 2, height: bandThickness * 2 }}
          onPointerDown={onBandPointerDown(c.handle)}
          onPointerMove={onBandPointerMove}
          onPointerUp={onBandPointerUp}
          onContextMenu={onBandContextMenu}
        />
      ))}
    </div>
  );
}
