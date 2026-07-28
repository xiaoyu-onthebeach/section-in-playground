import { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { DragState, Point, Rect, SceneModel } from '../types';
import { boundingBox, chromeAwarePadding, isFullyInside, rectsIntersect } from '../lib/geometry';
import { computeDropTarget } from '../lib/dragLogic';
import { computeMembership, membersOfSection } from '../lib/membership';
import { getDominantColorRgb } from '../lib/imageColor';
import { SECTION_BG_OPACITY, SECTION_EMPTY_BG_RGB } from '../lib/constants';

const EMPTY_SET: Set<string> = new Set();

/** Live render position for a scene, accounting for an in-progress scene or section-move drag. */
export function useScenePosition(scene: SceneModel): Point {
  return useCanvasStore((s) => {
    const { dragState, dragOriginScenePositions } = s;
    if (!dragState || !dragOriginScenePositions) return { x: scene.x, y: scene.y };

    let ids: string[] | null = null;
    if (dragState.kind === 'scene') ids = dragState.sceneIds;
    else if (dragState.kind === 'section-move') ids = dragState.memberIds;
    if (!ids || !ids.includes(scene.id)) return { x: scene.x, y: scene.y };

    const start = dragOriginScenePositions[scene.id];
    if (!start) return { x: scene.x, y: scene.y };
    const dx = dragState.current.x - dragState.origin.x;
    const dy = dragState.current.y - dragState.origin.y;
    return { x: start.x + dx, y: start.y + dy };
  });
}

/**
 * Live render rect for a section, accounting for an in-progress move,
 * resize, or — when this section is the current drop-target highlight for
 * a scene drag that would grow it — the grown preview rect, so the extended
 * boundary shows as soon as the dragged scene crosses the edge, not only
 * after release.
 */
export function useSectionRect(sectionId: string, committed: Rect): Rect {
  const highlight = useDragHighlight();
  return useCanvasStore((s) => {
    const live = computeLiveSectionMoveOrResizeRect(sectionId, s.dragState, s.dragOriginRects, s.resizePreviewRects);
    if (live) return live;
    if (s.dragState?.kind === 'scene' && highlight.sectionId === sectionId && highlight.grownRect) {
      return highlight.grownRect;
    }
    return committed;
  });
}

/** Shared by useSectionRect and useOverlappingFrontSectionIds — the section-move/resize live-preview part only (not the scene-drag grow-highlight case, which only ever applies to a single section at a time and doesn't need to be checked per-section in a loop). */
function computeLiveSectionMoveOrResizeRect(
  sectionId: string,
  dragState: DragState,
  dragOriginRects: Record<string, Rect> | null,
  resizePreviewRects: Record<string, Rect> | null
): Rect | null {
  if (dragState?.kind === 'section-move' && dragState.sectionIds.includes(sectionId) && dragOriginRects) {
    const origRect = dragOriginRects[sectionId];
    if (origRect) {
      const dx = dragState.current.x - dragState.origin.x;
      const dy = dragState.current.y - dragState.origin.y;
      return { x: origRect.x + dx, y: origRect.y + dy, width: origRect.width, height: origRect.height };
    }
  }
  if (dragState?.kind === 'section-resize' && dragState.sectionIds.includes(sectionId) && resizePreviewRects) {
    const preview = resizePreviewRects[sectionId];
    if (preview) return preview;
  }
  return null;
}

/** Sections currently rendered in front of at least one other section they geometrically overlap — i.e. "section 1 is on top of section 2" — so the front one's border stays visible even at rest (not just on hover/select), making the stacking relationship legible. Accounts for a live section-move/resize drag, not just the committed position. */
export function useOverlappingFrontSectionIds(): Set<string> {
  const sectionOrder = useCanvasStore((s) => s.sectionOrder);
  const sections = useCanvasStore((s) => s.sections);
  const dragState = useCanvasStore((s) => s.dragState);
  const dragOriginRects = useCanvasStore((s) => s.dragOriginRects);
  const resizePreviewRects = useCanvasStore((s) => s.resizePreviewRects);

  return useMemo(() => {
    const liveRect = (id: string): Rect | null => {
      const committed = sections[id];
      if (!committed) return null;
      return computeLiveSectionMoveOrResizeRect(id, dragState, dragOriginRects, resizePreviewRects) ?? committed;
    };

    const result = new Set<string>();
    for (let i = 0; i < sectionOrder.length; i++) {
      const rect = liveRect(sectionOrder[i]);
      if (!rect) continue;
      for (let j = 0; j < i; j++) {
        const otherRect = liveRect(sectionOrder[j]);
        if (otherRect && rectsIntersect(rect, otherRect)) {
          result.add(sectionOrder[i]);
          break;
        }
      }
    }
    return result.size ? result : EMPTY_SET;
  }, [sectionOrder, sections, dragState, dragOriginRects, resizePreviewRects]);
}

/** Which section (if any) should show the drop-target highlight during a scene drag. */
export function useDragHighlight(): { sectionId: string | null; grownRect: Rect | null } {
  return useCanvasStore((s) => {
    if (s.dragState?.kind !== 'scene' || !s.dragOriginScenePositions) return { sectionId: null, grownRect: null };
    const { sceneIds, origin, current, originSectionId } = s.dragState;
    const dx = current.x - origin.x;
    const dy = current.y - origin.y;
    // dragState is set on pointerdown, before any actual movement — a plain
    // click/select on a scene that's already fully inside its own section
    // would otherwise compute that section as the highlight target at zero
    // displacement. Require real movement so highlight only shows once the
    // user is actually moving a scene, not merely selecting one.
    if (dx === 0 && dy === 0) return { sectionId: null, grownRect: null };
    const movedRects: Rect[] = [];
    for (const id of sceneIds) {
      const start = s.dragOriginScenePositions[id];
      const sc = s.scenes[id];
      if (!start || !sc) continue;
      movedRects.push({ x: start.x + dx, y: start.y + dy, width: sc.width, height: sc.height });
    }
    if (movedRects.length === 0) return { sectionId: null, grownRect: null };
    const bbox = boundingBox(movedRects);
    const result = computeDropTarget(bbox, s.sections, originSectionId, chromeAwarePadding(s.debug.growPadding, s.viewport.zoom));
    // Dropping back into (or staying within) the section the scene already
    // belongs to isn't a meaningful state change, so it shouldn't glow —
    // only show the highlight when the drag would actually create/change
    // membership into a different section. The actual drop commit
    // (endSceneDrag) still uses the unfiltered result, so a scene that's
    // still fully inside its own section on release correctly stays a
    // member — this only suppresses the visual, not the outcome.
    if (result.sectionId === originSectionId) return { sectionId: null, grownRect: null };
    return { sectionId: result.sectionId, grownRect: result.grownRect };
  });
}

/**
 * Members of any section(s) currently being resized that would fall outside
 * their own live resize preview — scenes render as top-level siblings above
 * all section boxes (z-order), not nested under SectionView, so the
 * "leaving" flag has to reach them there.
 */
export function useActiveLeavingIds(): Set<string> {
  return useCanvasStore((s) => {
    if (s.dragState?.kind !== 'section-resize' || !s.resizePreviewRects) return EMPTY_SET;
    const leavingIds: string[] = [];
    for (const sectionId of s.dragState.sectionIds) {
      const preview = s.resizePreviewRects[sectionId];
      if (!preview) continue;
      for (const m of membersOfSection(sectionId, s.scenes)) {
        if (!isFullyInside(m, preview)) leavingIds.push(m.id);
      }
    }
    return leavingIds.length ? new Set(leavingIds) : EMPTY_SET;
  });
}

/**
 * Loose scenes that would be captured if the in-progress drag dropped right
 * now — either an existing section being moved over them (section-move,
 * possibly several at once), or a brand-new section being drawn with the
 * Section tool (section-draw) that happens to fully enclose them.
 */
export function useActiveCaptureIds(): Set<string> {
  return useCanvasStore((s) => {
    let previewRects: Rect[] = [];
    if (s.dragState?.kind === 'section-move' && s.dragOriginRects) {
      const dx = s.dragState.current.x - s.dragState.origin.x;
      const dy = s.dragState.current.y - s.dragState.origin.y;
      previewRects = s.dragState.sectionIds
        .map((id) => s.dragOriginRects![id])
        .filter((r): r is Rect => Boolean(r))
        .map((r) => ({ x: r.x + dx, y: r.y + dy, width: r.width, height: r.height }));
    } else if (s.dragState?.kind === 'section-draw' && s.drawPreviewRect) {
      previewRects = [s.drawPreviewRect];
    }
    if (previewRects.length === 0) return EMPTY_SET;
    const loose = Object.values(s.scenes).filter((sc) => sc.sectionId === null);
    const captured = loose.filter((sc) => previewRects.some((pr) => isFullyInside(sc, pr)));
    return captured.length ? new Set(captured.map((sc) => sc.id)) : EMPTY_SET;
  });
}

const EMPTY_MAP: Map<string, string> = new Map();

/**
 * Scenes currently visually covered by some OTHER section rendered in front
 * of them — either a loose scene geometrically "trapped" inside a section's
 * bounds (see SceneView's `isTrapped`), or a true member whose own section
 * sits behind (earlier in sectionOrder than) another section that overlaps
 * it. `hostSectionId` gives, for each covered scene, the frontmost section
 * it's covered by — Canvas.tsx uses this to actually render that scene
 * behind that section (not just visually tinted) so it doesn't sit on top
 * of that section's own real members either. `coveredIds` (the key set of
 * `hostSectionId`) is what SceneOverlayLayer uses to also hide/dim that
 * scene's floating name label + menu button, which live in a separate
 * screen-space layer and otherwise wouldn't know to respect this stacking.
 * The scene being actively dragged is exempted so it reads as fully "live"
 * mid-drag.
 * A loose scene that's currently a live capture-preview target (see
 * `useActiveCaptureIds`) is also exempted, same reasoning as the actively-
 * dragged scene above: it should read as "about to join, hover-highlighted"
 * rather than dimmed/covered, even if it happens to sit under a section's
 * (pre-drag) resting bounds.
 */
export function useVisuallyCoveredSceneIds(): { coveredIds: Set<string>; hostSectionId: Map<string, string> } {
  const scenes = useCanvasStore((s) => s.scenes);
  const sceneOrder = useCanvasStore((s) => s.sceneOrder);
  const sections = useCanvasStore((s) => s.sections);
  const sectionOrder = useCanvasStore((s) => s.sectionOrder);
  const dragState = useCanvasStore((s) => s.dragState);
  const captureIds = useActiveCaptureIds();

  return useMemo(() => {
    const draggingIds = dragState?.kind === 'scene' ? new Set(dragState.sceneIds) : null;
    const sectionIndex = new Map(sectionOrder.map((id, i) => [id, i]));
    const hostSectionId = new Map<string, string>();
    for (const sceneId of sceneOrder) {
      const scene = scenes[sceneId];
      if (!scene) continue;
      if (draggingIds?.has(sceneId)) continue;
      if (captureIds.has(sceneId)) continue;
      const ownIndex = scene.sectionId ? sectionIndex.get(scene.sectionId) ?? -1 : -1;
      let host: string | null = null;
      for (const sectionId of sectionOrder) {
        if ((sectionIndex.get(sectionId) ?? -1) <= ownIndex) continue; // only sections strictly in front
        const section = sections[sectionId];
        if (section && rectsIntersect(scene, section)) host = sectionId; // keep going — last match is frontmost
      }
      if (host) hostSectionId.set(sceneId, host);
    }
    return { coveredIds: hostSectionId.size ? new Set(hostSectionId.keys()) : EMPTY_SET, hostSectionId: hostSectionId.size ? hostSectionId : EMPTY_MAP };
  }, [scenes, sceneOrder, sections, sectionOrder, dragState, captureIds]);
}

/** Membership map, keyed off each scene's stored sectionId (see SceneModel.sectionId). */
export function useMembership(): Map<string, string> {
  const scenes = useCanvasStore((s) => s.scenes);
  return useMemo(() => computeMembership(scenes), [scenes]);
}

/**
 * A section's fill color. When auto-pick is on (default): the fixed design
 * default while empty, or — once it has a member — the darker of that
 * member's top-2 dominant colors by pixel occupancy (see lib/imageColor.ts),
 * both at the same fixed opacity. Uses the first member (by scene order) as
 * the source if there's more than one. When auto-pick is off (debug panel
 * toggle): every section, empty or not, uses the fixed design default —
 * no image sampling happens at all.
 */
export function useSectionBackground(sectionId: string): string {
  const scenes = useCanvasStore((s) => s.scenes);
  const sceneOrder = useCanvasStore((s) => s.sceneOrder);
  const autoPickColor = useCanvasStore((s) => s.debug.autoPickColor);
  const firstMemberImage = useMemo(() => {
    for (const id of sceneOrder) {
      const sc = scenes[id];
      if (sc && sc.sectionId === sectionId) return sc.image;
    }
    return null;
  }, [scenes, sceneOrder, sectionId]);

  const [sampledRgb, setSampledRgb] = useState<string | null>(null);

  useEffect(() => {
    if (!autoPickColor || !firstMemberImage) {
      setSampledRgb(null);
      return;
    }
    let cancelled = false;
    getDominantColorRgb(firstMemberImage).then((rgb) => {
      if (!cancelled) setSampledRgb(rgb);
    });
    return () => {
      cancelled = true;
    };
  }, [firstMemberImage, autoPickColor]);

  const rgb = autoPickColor && firstMemberImage && sampledRgb ? sampledRgb : SECTION_EMPTY_BG_RGB;
  return `rgba(${rgb}, ${SECTION_BG_OPACITY})`;
}
