import { useCanvasStore } from '../../store/canvasStore';
import type { ResizeHandle } from '../../types';
import { useCanvasOrigin } from '../../canvas/CanvasOriginContext';
import './ResizeHandles.css';

const HANDLES: { id: ResizeHandle; cursor: string; style: React.CSSProperties }[] = [
  { id: 'nw', cursor: 'nwse-resize', style: { left: 0, top: 0 } },
  { id: 'n', cursor: 'ns-resize', style: { left: '50%', top: 0 } },
  { id: 'ne', cursor: 'nesw-resize', style: { left: '100%', top: 0 } },
  { id: 'w', cursor: 'ew-resize', style: { left: 0, top: '50%' } },
  { id: 'e', cursor: 'ew-resize', style: { left: '100%', top: '50%' } },
  { id: 'sw', cursor: 'nesw-resize', style: { left: 0, top: '100%' } },
  { id: 's', cursor: 'ns-resize', style: { left: '50%', top: '100%' } },
  { id: 'se', cursor: 'nwse-resize', style: { left: '100%', top: '100%' } },
];

const HANDLE_SIZE = 10;

export function ResizeHandles({ sectionId }: { sectionId: string }) {
  const startSectionResize = useCanvasStore((s) => s.startSectionResize);
  const updateSectionResize = useCanvasStore((s) => s.updateSectionResize);
  const endSectionResize = useCanvasStore((s) => s.endSectionResize);
  const { toWorld } = useCanvasOrigin();

  // Rendered inside SectionBordersLayer, a screen-space overlay with no
  // scaled ancestor — so unlike when these lived inside canvas-world, the
  // hit-target size here is just a plain constant, not divided by zoom.
  const size = HANDLE_SIZE;

  return (
    <>
      {HANDLES.map((h) => (
        <div
          key={h.id}
          className="resize-handle"
          data-handle={h.id}
          style={{ ...h.style, cursor: h.cursor, width: size, height: size, margin: -size / 2 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            startSectionResize(sectionId, h.id, toWorld(e.clientX, e.clientY));
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0) return;
            updateSectionResize(toWorld(e.clientX, e.clientY));
          }}
          onPointerUp={(e) => {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
            endSectionResize();
          }}
        />
      ))}
    </>
  );
}
