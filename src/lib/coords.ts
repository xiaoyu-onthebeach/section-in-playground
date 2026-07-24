import type { Point, Viewport } from '../types';

export function screenToWorld(viewport: Viewport, screenPoint: Point, containerOrigin: Point): Point {
  const localX = screenPoint.x - containerOrigin.x;
  const localY = screenPoint.y - containerOrigin.y;
  return {
    x: (localX - viewport.panX) / viewport.zoom,
    y: (localY - viewport.panY) / viewport.zoom,
  };
}

export function worldToScreen(viewport: Viewport, worldPoint: Point): Point {
  return {
    x: worldPoint.x * viewport.zoom + viewport.panX,
    y: worldPoint.y * viewport.zoom + viewport.panY,
  };
}
