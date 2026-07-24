import type { Rect, SectionModel } from '../types';
import {
  boundingBox,
  clampMinSize,
  growToContain,
  isFullyInside,
  rectBottom,
  rectRight,
  rectsIntersect,
  intersectionArea,
  type EdgePadding,
} from './geometry';

export interface HighlightResult {
  sectionId: string | null;
  willGrow: boolean;
  grownRect: Rect | null;
}

/**
 * Single source of truth for "would dropping here create/keep membership".
 * Used identically for live drag-over highlight AND the drop commit, so the
 * highlight grammar contract (highlight visible <=> release creates/keeps
 * membership) can never drift.
 *
 * Sections may overlap freely — growth is never blocked by another section.
 * When the dragged bounds intersect more than one section, only the one
 * with the larger intersection area wins (single membership per scene);
 * the other section's own geometry and members are left untouched.
 *
 * `originSectionId`: the section the dragged bounds currently belong to
 * (pre-drag). That section is only eligible via the trivial "still fully
 * inside" case — moving out of it never triggers growth (escape, not
 * capture).
 */
export function computeDropTarget(
  bbox: Rect,
  sections: Record<string, SectionModel>,
  originSectionId: string | null,
  growPadding: EdgePadding
): HighlightResult {
  let best: HighlightResult = { sectionId: null, willGrow: false, grownRect: null };
  let bestArea = 0;

  for (const section of Object.values(sections)) {
    if (!rectsIntersect(bbox, section)) continue;

    const fullyInside = isFullyInside(bbox, section);
    let willGrow = false;
    let grownRect: Rect | null = null;

    if (!fullyInside) {
      if (section.id === originSectionId) continue; // leaving your own section is an escape, not growth
      willGrow = true;
      grownRect = growToContain(section, bbox, growPadding);
    }

    const area = intersectionArea(bbox, section);
    if (area >= bestArea) {
      bestArea = area;
      best = { sectionId: section.id, willGrow, grownRect };
    }
  }

  return best;
}

/** Wrap-selection section rect: bbox padded on each side. Overlapping an existing section is fine. */
export function computeWrapRect(bbox: Rect, padding: EdgePadding): Rect {
  return {
    x: bbox.x - padding.left,
    y: bbox.y - padding.top,
    width: bbox.width + padding.left + padding.right,
    height: bbox.height + padding.top + padding.bottom,
  };
}

/**
 * After a member scene is removed, shrink `section` inward on whichever
 * edge(s) now have slack beyond `padding` around the remaining members —
 * growToContain in reverse. An edge with no slack (another member still
 * reaches it) is left untouched, so removing an interior/center scene —
 * which doesn't change the remaining members' bounding box — never shrinks
 * the section at all; only an edge scene whose removal actually pulls a
 * bound inward triggers a shrink on that specific side. Never expands,
 * never shrinks below the section minimum size.
 */
export function computeAutoShrink(section: Rect, remainingMembers: Rect[], padding: EdgePadding, minWidth: number, minHeight: number): Rect {
  if (remainingMembers.length === 0) return section; // nothing to fit to — leave the now-empty section as-is
  const bbox = boundingBox(remainingMembers);
  const targetLeft = bbox.x - padding.left;
  const targetTop = bbox.y - padding.top;
  const targetRight = rectRight(bbox) + padding.right;
  const targetBottom = rectBottom(bbox) + padding.bottom;

  const left = Math.max(section.x, targetLeft);
  const top = Math.max(section.y, targetTop);
  const right = Math.min(rectRight(section), targetRight);
  const bottom = Math.min(rectBottom(section), targetBottom);

  return clampMinSize({ x: left, y: top, width: right - left, height: bottom - top }, minWidth, minHeight, { left: false, top: false });
}
