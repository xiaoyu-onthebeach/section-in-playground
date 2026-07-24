import { useCanvasStore } from '../../store/canvasStore';
import './DragOverlays.css';

export function DragOverlays() {
  const dragState = useCanvasStore((s) => s.dragState);
  const drawPreviewRect = useCanvasStore((s) => s.drawPreviewRect);

  if (dragState?.kind === 'section-draw' && drawPreviewRect) {
    return (
      <div
        className="draw-preview"
        style={{
          left: drawPreviewRect.x,
          top: drawPreviewRect.y,
          width: drawPreviewRect.width,
          height: drawPreviewRect.height,
        }}
      />
    );
  }

  if (dragState?.kind === 'marquee') {
    const { origin, current } = dragState;
    const x = Math.min(origin.x, current.x);
    const y = Math.min(origin.y, current.y);
    const width = Math.abs(current.x - origin.x);
    const height = Math.abs(current.y - origin.y);
    return <div className="marquee-preview" style={{ left: x, top: y, width, height }} />;
  }

  return null;
}
