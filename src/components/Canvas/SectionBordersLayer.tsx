import { useCanvasStore } from '../../store/canvasStore';
import { useSectionRect, useDragHighlight, useOverlappingFrontSectionIds } from '../../hooks/useDerivedState';
import { worldToScreen } from '../../lib/coords';
import { DRAW_PREVIEW_BORDER_RADIUS, SECTION_BORDER_RADIUS } from '../../lib/constants';
import { ResizeHandles } from './ResizeHandles';
import type { SectionModel } from '../../types';
import './SectionBordersLayer.css';

// Screen-space overlay for section borders — CSS border-width gets snapped
// to whole device pixels by the browser, so the old approach (draw the
// border inside canvas-world with `width/zoom` counter-scaling) produced a
// visibly different rendered thickness at different zoom levels (e.g. 1px
// intended could render as 1px, 2px, or 3px depending on what `1/zoom`
// happened to round to). Rendering the border here instead — outside
// canvas-world's scale(zoom) transform, at a plain literal width that's
// never divided by zoom — sidesteps that rounding entirely: the same exact
// CSS number is used at every zoom level, so it snaps to the same pixel
// count every time. Position/size still track the live section rect in
// screen space so the box itself continues to scale with zoom normally.
//
// This also subsumes the old ".section-selected-echo" — since this layer
// already renders above every scene (same stacking approach as
// SectionLabelsLayer/SceneOverlayLayer), there's no need for a second
// "redraw the border above scenes when selected" element; the border is
// simply always here.

const BORDER_WIDTH = 1.5;
const BORDER_WIDTH_SELECTED = 1.5;
const BORDER_WIDTH_HIGHLIGHT = 2.5;
const DRAW_PREVIEW_BORDER_WIDTH = 1.5; // matches .draw-preview's border in DragOverlays.css

export function SectionBordersLayer() {
  const sectionOrder = useCanvasStore((s) => s.sectionOrder);
  const sections = useCanvasStore((s) => s.sections);
  const overlappingFrontIds = useOverlappingFrontSectionIds();

  return (
    <div className="section-borders-layer">
      {sectionOrder.map((id) => {
        const section = sections[id];
        if (!section) return null;
        return <SectionBorder key={id} section={section} isOverlappingFront={overlappingFrontIds.has(id)} />;
      })}
      <DrawPreviewBorder />
    </div>
  );
}

// Same screen-space technique as SectionBorder below, for the in-progress
// "drawing a new section" preview — its fill stays in DragOverlays (behind
// scenes), but the border is drawn here at a literal, non-zoom-divided
// width so it doesn't visibly change thickness as the canvas zooms.
function DrawPreviewBorder() {
  const dragState = useCanvasStore((s) => s.dragState);
  const drawPreviewRect = useCanvasStore((s) => s.drawPreviewRect);
  const viewport = useCanvasStore((s) => s.viewport);

  if (dragState?.kind !== 'section-draw' || !drawPreviewRect) return null;

  const screenPos = worldToScreen(viewport, { x: drawPreviewRect.x, y: drawPreviewRect.y });
  return (
    <div
      className="draw-preview-border"
      style={{
        left: screenPos.x,
        top: screenPos.y,
        width: drawPreviewRect.width * viewport.zoom,
        height: drawPreviewRect.height * viewport.zoom,
        borderWidth: DRAW_PREVIEW_BORDER_WIDTH,
        borderRadius: DRAW_PREVIEW_BORDER_RADIUS,
      }}
    />
  );
}

function SectionBorder({ section, isOverlappingFront }: { section: SectionModel; isOverlappingFront: boolean }) {
  const rect = useSectionRect(section.id, section);
  const viewport = useCanvasStore((s) => s.viewport);
  const isSelected = useCanvasStore((s) => s.selection.sectionIds.includes(section.id));
  const isMoving = useCanvasStore((s) => s.dragState?.kind === 'section-move' && s.dragState.sectionIds.includes(section.id));
  const isResizing = useCanvasStore((s) => s.dragState?.kind === 'section-resize' && s.dragState.sectionIds.includes(section.id));
  const isGrowing = useCanvasStore((s) => s.growingSectionId === section.id);
  const growDuration = useCanvasStore((s) => s.debug.growDuration);
  const highlight = useDragHighlight();
  const isHighlighted = highlight.sectionId === section.id;
  const isHovered = useCanvasStore((s) => s.hoveredSectionId === section.id);
  const sectionBorderColor = useCanvasStore((s) => s.debug.sectionBorderColor);

  const screenPos = worldToScreen(viewport, { x: rect.x, y: rect.y });
  const width = rect.width * viewport.zoom;
  const height = rect.height * viewport.zoom;
  const borderRadius = SECTION_BORDER_RADIUS;

  // Resting/unselected sections show no border at all — hovering brings it
  // back (same width/color as before this change), selection always shows it
  // regardless of hover, and a section rendered in front of another one it
  // geometrically overlaps also keeps its border, so the stacking/"on top
  // of" relationship stays legible without needing to hover it first.
  const borderWidth = isHighlighted
    ? BORDER_WIDTH_HIGHLIGHT
    : isSelected
      ? BORDER_WIDTH_SELECTED
      : isHovered || isOverlappingFront
        ? BORDER_WIDTH
        : 0;
  const borderColor = isHighlighted
    ? 'var(--section-border-highlight)'
    : isSelected
      ? 'var(--section-border-selected)'
      : sectionBorderColor;

  return (
    <div
      className={['section-border-box', isSelected && 'section-border-box--selected', isHighlighted && 'section-border-box--highlight']
        .filter(Boolean)
        .join(' ')}
      style={{
        left: screenPos.x,
        top: screenPos.y,
        width,
        height,
        borderWidth,
        borderColor,
        borderRadius,
        // Also animates the LIVE grow/shrink preview while a scene drag is
        // hovering this section (isHighlighted), matching SectionView's fill
        // so the border eases into the grown size in sync with it, instead
        // of popping to it instantly the moment the scene crosses the edge.
        transition:
          (isGrowing || isHighlighted) && !isMoving && !isResizing
            ? `left ${growDuration}ms ease-out, top ${growDuration}ms ease-out, width ${growDuration}ms ease-out, height ${growDuration}ms ease-out`
            : 'none',
      }}
    >
      {isSelected && <ResizeHandles sectionId={section.id} />}
    </div>
  );
}
