import type { Rect } from '../types';
import { SCENE_LABEL_CHROME_HEIGHT, SCENE_MENU_CHROME_HEIGHT } from './constants';

export const rectRight = (r: Rect) => r.x + r.width;
export const rectBottom = (r: Rect) => r.y + r.height;

export interface EdgePadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function uniformPadding(padding: number): EdgePadding {
  return { top: padding, bottom: padding, left: padding, right: padding };
}

/**
 * Padding for growing/wrapping/shrinking a section around scenes, accounting
 * for each scene's fixed-screen-size chrome (name label above, "..." menu
 * button below) on top of the base padding — divided by zoom to convert
 * their constant on-screen size into the matching world-space amount at the
 * current zoom, so the section's boundary visually encloses the chrome too,
 * not just the bare scene frame. Left/right get only the base padding since
 * there's no chrome on those sides.
 */
export function chromeAwarePadding(basePadding: number, zoom: number): EdgePadding {
  return {
    top: basePadding + SCENE_LABEL_CHROME_HEIGHT / zoom,
    bottom: basePadding + SCENE_MENU_CHROME_HEIGHT / zoom,
    left: basePadding,
    right: basePadding,
  };
}

/** Fully-inside containment: outer must fully contain inner (touching edges count as inside). */
export function isFullyInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  );
}

/** True if two rects share any positive area (touching edges = not overlapping). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < rectRight(b) &&
    rectRight(a) > b.x &&
    a.y < rectBottom(b) &&
    rectBottom(a) > b.y
  );
}

export function intersectionArea(a: Rect, b: Rect): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(rectRight(a), rectRight(b));
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(rectBottom(a), rectBottom(b));
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(rectRight(a), rectRight(b));
  const bottom = Math.max(rectBottom(a), rectBottom(b));
  return { x, y, width: right - x, height: bottom - y };
}

export function boundingBox(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  return rects.reduce((acc, r) => unionRect(acc, r));
}

export function translateRect(r: Rect, dx: number, dy: number): Rect {
  return { ...r, x: r.x + dx, y: r.y + dy };
}

/**
 * Grow `section` to contain `scene` fully, expanding only the overflowed
 * side(s) by `padding`. Opposite edges never move.
 */
export function growToContain(section: Rect, scene: Rect, padding: EdgePadding): Rect {
  let left = section.x;
  let top = section.y;
  let right = rectRight(section);
  let bottom = rectBottom(section);

  if (scene.x < section.x) left = scene.x - padding.left;
  if (scene.y < section.y) top = scene.y - padding.top;
  if (rectRight(scene) > right) right = rectRight(scene) + padding.right;
  if (rectBottom(scene) > bottom) bottom = rectBottom(scene) + padding.bottom;

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function clampMinSize(r: Rect, minW: number, minH: number, anchor: { left?: boolean; top?: boolean; right?: boolean; bottom?: boolean }): Rect {
  let { x, y, width, height } = r;
  if (width < minW) {
    if (anchor.left) x = x + width - minW; // left edge moved, keep right fixed
    width = minW;
  }
  if (height < minH) {
    if (anchor.top) y = y + height - minH;
    height = minH;
  }
  return { x, y, width, height };
}
