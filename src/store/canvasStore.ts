import { create } from 'zustand';
import type {
  CanvasSnapshot,
  ContextMenuState,
  DragState,
  Point,
  Rect,
  ResizeHandle,
  SceneModel,
  SectionModel,
  Selection,
  ToolId,
  Viewport,
} from '../types';
import { clampMinSize, isFullyInside, rectsIntersect, translateRect, boundingBox, growToContain, chromeAwarePadding, sceneOutlineGap } from '../lib/geometry';
import { computeAutoShrink, computeDropTarget, computeWrapRect } from '../lib/dragLogic';
import { membersOfSection } from '../lib/membership';
import { makeId } from '../lib/id';
import { createDefaultSnapshot, randomImage, SCENARIOS } from '../lib/seed';
import {
  DEFAULT_GROW_DURATION,
  DEFAULT_GROW_PADDING,
  SCENE_COLOR,
  SCENE_SIZE,
  SECTION_BORDER_COLOR_DEFAULT,
  SECTION_ICON_COLOR_DEFAULT,
  SECTION_MIN_HEIGHT,
  SECTION_MIN_WIDTH,
  VARIATION_GAP,
  WRAP_PADDING_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
} from '../lib/constants';

interface DebugSettings {
  showBounds: boolean;
  growPadding: number;
  growDuration: number;
  /** Padding applied around a selection's bbox when wrapping it into a new section (Cmd/Ctrl+Alt+G). */
  wrapPadding: number;
  /** When false, section fill skips image sampling entirely and uses the fixed design-default fill for every section. */
  autoPickColor: boolean;
  sectionBorderColor: string;
  sectionIconColor: string;
}

interface CanvasState {
  scenes: Record<string, SceneModel>;
  sections: Record<string, SectionModel>;
  sceneOrder: string[];
  sectionOrder: string[];

  selection: Selection;
  viewport: Viewport;
  tool: ToolId;
  debug: DebugSettings;

  renamingSectionId: string | null;
  contextMenu: ContextMenuState;
  toast: string | null;

  dragState: DragState;
  /** Origin rect per section id, for an in-progress group-aware move or resize (keyed even when only one section is involved). */
  dragOriginRects: Record<string, Rect> | null;
  dragOriginScenePositions: Record<string, Point> | null;
  drawPreviewRect: Rect | null;
  /** Live resize preview rect per section id — see dragOriginRects. */
  resizePreviewRects: Record<string, Rect> | null;
  growingSectionId: string | null;
  /** Section currently under the pointer (plain hover, no drag) — drives the border's default/hover visibility in SectionBordersLayer. */
  hoveredSectionId: string | null;
  /** Scene currently under the pointer (plain hover, no drag) — drives the wrap-outline shown around its label/frame/menu button in SceneOverlayLayer. */
  hoveredSceneId: string | null;
  scenarioId: string;

  undoStack: CanvasSnapshot[];
  redoStack: CanvasSnapshot[];

  // --- scenario / lifecycle ---
  resetToScenario: (id: string) => void;

  // --- tool / viewport ---
  setTool: (tool: ToolId) => void;
  setViewport: (v: Partial<Viewport>) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screenPoint: Point, newZoom: number) => void;
  /** Sets zoom directly without re-centering — used by the debug panel's zoom slider. */
  setZoom: (zoom: number) => void;

  // --- selection ---
  selectScene: (id: string, additive: boolean) => void;
  selectSection: (id: string, additive: boolean) => void;
  clearSelection: () => void;

  // --- scene drag ---
  /** Resolves click-vs-drag selection semantics, then starts the drag. */
  beginScenePointerDown: (sceneId: string, additive: boolean, origin: Point) => string[];
  startSceneDrag: (sceneIds: string[], origin: Point) => void;
  updateSceneDrag: (point: Point) => void;
  endSceneDrag: () => void;

  // --- section move ---
  startSectionMove: (sectionId: string, origin: Point) => void;
  updateSectionMove: (point: Point) => void;
  endSectionMove: () => void;

  // --- section resize ---
  startSectionResize: (sectionId: string, handle: ResizeHandle, origin: Point) => void;
  updateSectionResize: (point: Point) => void;
  endSectionResize: () => void;

  // --- section draw ---
  startSectionDraw: (origin: Point) => void;
  updateSectionDraw: (point: Point) => void;
  endSectionDraw: () => void;

  // --- marquee ---
  startMarquee: (origin: Point, additive: boolean) => void;
  updateMarquee: (point: Point) => void;
  endMarquee: () => void;

  cancelDrag: () => void;

  // --- section ops ---
  wrapSelectionIntoSection: () => void;
  beginRenameSection: (id: string) => void;
  commitRenameSection: (id: string, name: string) => void;
  cancelRenameSection: () => void;
  /** Boundary only — used by Dissolve/Remove. Former members are released back to loose. One undo step for the whole batch. */
  deleteSectionBoundary: (ids: string[]) => void;
  /** Section(s) + their member scenes. Bound to the default Delete action. One undo step for the whole batch. */
  deleteSectionWithContents: (ids: string[]) => void;
  dissolveSection: (ids: string[]) => void;
  /** Duplicates all given sections (+ members) in one undo step, each offset to a free position. */
  duplicateSection: (ids: string[]) => void;
  /** Copies section(s) + members to an in-memory clipboard (no store state — see `sectionClipboard` below). */
  copySection: (ids: string[]) => void;
  /** Pastes whatever's in the clipboard as new section(s), offset from their copied position. No-op if clipboard is empty. */
  pasteSection: () => void;
  bringSectionToFront: (ids: string[]) => void;
  sendSectionToBack: (ids: string[]) => void;
  /** Deletes individual scenes (bound to Delete/Backspace when scenes, not a section, are selected). Any section that loses a member auto-shrinks to its remaining members' bounds + grow padding, on whichever edge(s) now have slack. */
  deleteScenes: (ids: string[]) => void;
  /** Doubling a member scene: adds 4 new scenes below it (same section), and grows the section to contain them. One undo step. */
  generateVariations: (sceneId: string) => void;
  /** New loose scene centered on `point` (right-click-empty-canvas menu). */
  createSceneAt: (point: Point) => void;
  /** New empty section (min size) centered on `point`; captures any loose scenes it happens to fully enclose, same as drag-to-draw. */
  createSectionAt: (point: Point) => void;

  openSectionContextMenu: (x: number, y: number, sectionId: string) => void;
  openSceneContextMenu: (x: number, y: number) => void;
  openCanvasContextMenu: (x: number, y: number, world: Point) => void;
  closeContextMenu: () => void;
  showToast: (msg: string) => void;

  undo: () => void;
  redo: () => void;

  setHoveredSection: (id: string | null) => void;
  setHoveredScene: (id: string | null) => void;
  setDebugShowBounds: (v: boolean) => void;
  setGrowPadding: (v: number) => void;
  setGrowDuration: (v: number) => void;
  setWrapPadding: (v: number) => void;
  setAutoPickColor: (v: boolean) => void;
  setSectionBorderColor: (v: string) => void;
  setSectionIconColor: (v: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let growTimer: ReturnType<typeof setTimeout> | null = null;
/** Copy/paste "clipboard" for sections — plain module state, not store state, since nothing needs to render off it (paste is keyboard-only, same as undo/redo). */
let sectionClipboard: { section: SectionModel; members: SceneModel[] }[] | null = null;

function snapshot(state: CanvasState): CanvasSnapshot {
  return structuredClone({
    scenes: state.scenes,
    sections: state.sections,
    sceneOrder: state.sceneOrder,
    sectionOrder: state.sectionOrder,
  });
}

function nextSectionName(sections: Record<string, SectionModel>): string {
  const used = new Set<number>();
  for (const s of Object.values(sections)) {
    const m = /^Section (\d+)$/.exec(s.name);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `Section ${n}`;
}

function nextSceneName(scenes: Record<string, SceneModel>): string {
  const used = new Set<number>();
  for (const sc of Object.values(scenes)) {
    const m = /^Scene (\d+)$/.exec(sc.name);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `Scene ${n}`;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  ...(() => {
    const initial = createDefaultSnapshot();
    return {
      scenes: initial.scenes,
      sections: initial.sections,
      sceneOrder: initial.sceneOrder,
      sectionOrder: initial.sectionOrder,
    };
  })(),

  selection: { sceneIds: [], sectionIds: [] },
  viewport: { panX: 80, panY: 60, zoom: 1 },
  tool: 'select',
  debug: {
    showBounds: false,
    growPadding: DEFAULT_GROW_PADDING,
    growDuration: DEFAULT_GROW_DURATION,
    wrapPadding: WRAP_PADDING_DEFAULT,
    autoPickColor: false,
    sectionBorderColor: SECTION_BORDER_COLOR_DEFAULT,
    sectionIconColor: SECTION_ICON_COLOR_DEFAULT,
  },

  renamingSectionId: null,
  contextMenu: null,
  toast: null,

  dragState: null,
  dragOriginRects: null,
  dragOriginScenePositions: null,
  drawPreviewRect: null,
  resizePreviewRects: null,
  growingSectionId: null,
  hoveredSectionId: null,
  hoveredSceneId: null,
  scenarioId: 'default',

  undoStack: [],
  redoStack: [],

  resetToScenario: (id) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    const snap = scenario.build();
    if (toastTimer) clearTimeout(toastTimer);
    if (growTimer) clearTimeout(growTimer);
    set({
      scenes: snap.scenes,
      sections: snap.sections,
      sceneOrder: snap.sceneOrder,
      sectionOrder: snap.sectionOrder,
      selection: { sceneIds: [], sectionIds: [] },
      tool: 'select',
      renamingSectionId: null,
      contextMenu: null,
      toast: null,
      dragState: null,
      dragOriginRects: null,
      dragOriginScenePositions: null,
      drawPreviewRect: null,
      resizePreviewRects: null,
      growingSectionId: null,
      hoveredSectionId: null,
      hoveredSceneId: null,
      scenarioId: id,
      undoStack: [],
      redoStack: [],
    });
  },

  setTool: (tool) => set({ tool }),

  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),

  panBy: (dx, dy) =>
    set((s) => ({ viewport: { ...s.viewport, panX: s.viewport.panX + dx, panY: s.viewport.panY + dy } })),

  zoomAt: (screenPoint, newZoomRaw) => {
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoomRaw));
    const { viewport } = get();
    const worldX = (screenPoint.x - viewport.panX) / viewport.zoom;
    const worldY = (screenPoint.y - viewport.panY) / viewport.zoom;
    const panX = screenPoint.x - worldX * newZoom;
    const panY = screenPoint.y - worldY * newZoom;
    set({ viewport: { panX, panY, zoom: newZoom } });
  },

  setZoom: (zoomRaw) => {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRaw));
    set((s) => ({ viewport: { ...s.viewport, zoom } }));
  },

  selectScene: (id, additive) =>
    set((s) => {
      if (additive) {
        const exists = s.selection.sceneIds.includes(id);
        const sceneIds = exists ? s.selection.sceneIds.filter((x) => x !== id) : [...s.selection.sceneIds, id];
        return { selection: { sceneIds, sectionIds: [] } };
      }
      return { selection: { sceneIds: [id], sectionIds: [] } };
    }),

  selectSection: (id, additive) =>
    set((s) => {
      if (additive) {
        const exists = s.selection.sectionIds.includes(id);
        const sectionIds = exists ? s.selection.sectionIds.filter((x) => x !== id) : [...s.selection.sectionIds, id];
        return { selection: { sceneIds: [], sectionIds } };
      }
      return { selection: { sceneIds: [], sectionIds: [id] } };
    }),

  clearSelection: () => set({ selection: { sceneIds: [], sectionIds: [] } }),

  // ---------------- scene drag ----------------
  beginScenePointerDown: (sceneId, additive, origin) => {
    const s = get();
    let sceneIds: string[];
    if (additive) {
      const exists = s.selection.sceneIds.includes(sceneId);
      sceneIds = exists ? s.selection.sceneIds.filter((x) => x !== sceneId) : [...s.selection.sceneIds, sceneId];
      set({ selection: { sceneIds, sectionIds: [] } });
    } else if (s.selection.sceneIds.includes(sceneId)) {
      // part of an existing multi-selection: keep it, drag the whole group
      sceneIds = s.selection.sceneIds;
    } else {
      sceneIds = [sceneId];
      set({ selection: { sceneIds, sectionIds: [] } });
    }
    if (sceneIds.length > 0) get().startSceneDrag(sceneIds, origin);
    return sceneIds;
  },

  startSceneDrag: (sceneIds, origin) => {
    const { scenes } = get();
    const originPositions: Record<string, Point> = {};
    for (const id of sceneIds) {
      const sc = scenes[id];
      if (sc) originPositions[id] = { x: sc.x, y: sc.y };
    }
    // Only exclude a "home" section from growth eligibility when every
    // dragged scene already shares the same one; mixed/loose selections
    // have no home to exclude.
    const sectionIds = new Set(sceneIds.map((id) => scenes[id]?.sectionId ?? null));
    const originSectionId = sectionIds.size === 1 ? [...sectionIds][0] : null;
    set({
      dragState: { kind: 'scene', sceneIds, origin, current: origin, originSectionId },
      dragOriginScenePositions: originPositions,
    });
  },

  updateSceneDrag: (point) =>
    set((s) => {
      if (s.dragState?.kind !== 'scene') return {};
      return { dragState: { ...s.dragState, current: point } };
    }),

  endSceneDrag: () => {
    const s = get();
    if (s.dragState?.kind !== 'scene' || !s.dragOriginScenePositions) {
      set({ dragState: null, dragOriginScenePositions: null });
      return;
    }
    const { sceneIds, origin, current, originSectionId } = s.dragState;
    const dx = current.x - origin.x;
    const dy = current.y - origin.y;

    if (dx === 0 && dy === 0) {
      set({ dragState: null, dragOriginScenePositions: null });
      return;
    }

    const snap_ = snapshot(s);
    const originPositions = s.dragOriginScenePositions;

    const movedScenes: SceneModel[] = [];
    for (const id of sceneIds) {
      const startPos = originPositions[id];
      const sc = s.scenes[id];
      if (!startPos || !sc) continue;
      movedScenes.push({ ...sc, x: startPos.x + dx, y: startPos.y + dy });
    }

    const bbox = boundingBox(movedScenes);
    const target = computeDropTarget(bbox, s.sections, originSectionId, chromeAwarePadding(s.debug.growPadding, s.viewport.zoom));
    const newSectionId = target.sectionId ?? null;

    const newScenes = { ...s.scenes };
    for (const sc of movedScenes) {
      newScenes[sc.id] = { ...sc, sectionId: newSectionId };
    }

    let newSections = s.sections;
    let animatedSectionId: string | null = null;
    if (target.sectionId && target.willGrow && target.grownRect) {
      newSections = {
        ...s.sections,
        [target.sectionId]: { ...s.sections[target.sectionId], ...target.grownRect },
      };
      animatedSectionId = target.sectionId;
    }

    // A scene that left its origin section (escaped to loose, or into a
    // different section) leaves that section to auto-shrink to its
    // remaining members, same padding/behavior as deleting a member scene.
    if (originSectionId && newSectionId !== originSectionId) {
      const originSection = newSections[originSectionId];
      if (originSection) {
        const remaining = Object.values(newScenes).filter((sc) => sc.sectionId === originSectionId);
        const shrunk = computeAutoShrink(originSection, remaining, chromeAwarePadding(s.debug.wrapPadding, s.viewport.zoom), SECTION_MIN_WIDTH, SECTION_MIN_HEIGHT);
        if (shrunk.x !== originSection.x || shrunk.y !== originSection.y || shrunk.width !== originSection.width || shrunk.height !== originSection.height) {
          newSections = { ...newSections, [originSectionId]: { ...originSection, ...shrunk } };
          animatedSectionId = originSectionId;
        }
      }
    }

    if (animatedSectionId) {
      if (growTimer) clearTimeout(growTimer);
      set({ growingSectionId: animatedSectionId });
      growTimer = setTimeout(() => set({ growingSectionId: null }), get().debug.growDuration + 20);
    }

    set({
      scenes: newScenes,
      sections: newSections,
      dragState: null,
      dragOriginScenePositions: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  // ---------------- section move ----------------
  // Moving one section that's part of a multi-selection moves the whole
  // group together (each keeps its own origin rect so they all translate by
  // the same dx/dy); moving one that isn't just moves that one, same as
  // before.
  startSectionMove: (sectionId, origin) => {
    const { sections, scenes, selection } = get();
    if (!sections[sectionId]) return;
    const targetIds = (selection.sectionIds.includes(sectionId) && selection.sectionIds.length > 1
      ? selection.sectionIds
      : [sectionId]
    ).filter((id) => sections[id]);
    if (targetIds.length === 0) return;

    const originRects: Record<string, Rect> = {};
    const memberIds: string[] = [];
    const originPositions: Record<string, Point> = {};
    for (const id of targetIds) {
      const r = sections[id];
      originRects[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
      for (const m of membersOfSection(id, scenes)) {
        memberIds.push(m.id);
        originPositions[m.id] = { x: m.x, y: m.y };
      }
    }

    // Selection itself is left to the caller (selectSection, additive-aware)
    // — every caller selects before starting the move, so this only ever
    // drives the drag, not which section(s) end up selected.
    set({
      dragState: {
        kind: 'section-move',
        sectionIds: targetIds,
        origin,
        current: origin,
        memberIds,
      },
      dragOriginRects: originRects,
      dragOriginScenePositions: originPositions,
    });
  },

  updateSectionMove: (point) => {
    const s = get();
    if (s.dragState?.kind !== 'section-move') return;
    // Sections can overlap freely now — no clamping against neighbors.
    set({ dragState: { ...s.dragState, current: point } });
  },

  endSectionMove: () => {
    const s = get();
    if (s.dragState?.kind !== 'section-move' || !s.dragOriginRects || !s.dragOriginScenePositions) {
      set({ dragState: null, dragOriginRects: null, dragOriginScenePositions: null });
      return;
    }
    const { sectionIds, origin, current, memberIds } = s.dragState;
    const dx = current.x - origin.x;
    const dy = current.y - origin.y;

    if (dx === 0 && dy === 0) {
      set({ dragState: null, dragOriginRects: null, dragOriginScenePositions: null });
      return;
    }

    const snap_ = snapshot(s);
    const newSections = { ...s.sections };
    const newRectsBySection: Record<string, Rect> = {};
    for (const id of sectionIds) {
      const origRect = s.dragOriginRects[id];
      if (!origRect) continue;
      const newRect = translateRect(origRect, dx, dy);
      newRectsBySection[id] = newRect;
      newSections[id] = { ...s.sections[id], ...newRect };
    }

    const newScenes = { ...s.scenes };
    for (const id of memberIds) {
      const startPos = s.dragOriginScenePositions[id];
      const sc = newScenes[id];
      if (!startPos || !sc) continue;
      newScenes[id] = { ...sc, x: startPos.x + dx, y: startPos.y + dy };
    }

    // Loose scenes now fully enclosed by any of the moved sections are
    // captured (first one they fully fit in wins — sections rarely overlap
    // closely enough for a scene to qualify for more than one). Scenes
    // already belonging to another section are left untouched even if the
    // (possibly now-overlapping) section geometrically contains them too —
    // overlap never reassigns existing membership.
    for (const sc of Object.values(newScenes)) {
      if (sc.sectionId !== null) continue;
      for (const id of sectionIds) {
        if (isFullyInside(sc, newRectsBySection[id])) {
          newScenes[sc.id] = { ...sc, sectionId: id };
          break;
        }
      }
    }

    set({
      scenes: newScenes,
      sections: newSections,
      dragState: null,
      dragOriginRects: null,
      dragOriginScenePositions: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  // ---------------- section resize ----------------
  // Resizing one section that's part of a multi-selection scales the whole
  // group proportionally, relative to their combined bounding box (same
  // idea as Figma-style group resize): each section's rect transforms by
  // the same scale factor + anchor as the group bbox, floored so no
  // individual section drops below the minimum size. With only one section
  // targeted this reduces to exactly the old single-section clamp-to-min
  // behavior (the "group" bbox IS that section's own rect).
  startSectionResize: (sectionId, handle, origin) => {
    const { sections, selection } = get();
    if (!sections[sectionId]) return;
    const targetIds = (selection.sectionIds.includes(sectionId) && selection.sectionIds.length > 1
      ? selection.sectionIds
      : [sectionId]
    ).filter((id) => sections[id]);
    if (targetIds.length === 0) return;

    const originRects: Record<string, Rect> = {};
    for (const id of targetIds) {
      const r = sections[id];
      originRects[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }

    // Selection is left to the caller (selectSection), same reasoning as startSectionMove above.
    set({
      dragState: { kind: 'section-resize', sectionIds: targetIds, handle, origin, current: origin },
      dragOriginRects: originRects,
      resizePreviewRects: originRects,
    });
  },

  updateSectionResize: (point) => {
    const s = get();
    if (s.dragState?.kind !== 'section-resize' || !s.dragOriginRects) return;
    const { handle, sectionIds } = s.dragState;
    const dx = point.x - s.dragState.origin.x;
    const dy = point.y - s.dragState.origin.y;

    const origRects = sectionIds.map((id) => s.dragOriginRects![id]).filter((r): r is Rect => Boolean(r));
    if (origRects.length === 0) return;
    const groupOrigin = boundingBox(origRects);

    const movesLeft = handle.includes('w');
    const movesRight = handle.includes('e');
    const movesTop = handle.includes('n');
    const movesBottom = handle.includes('s');

    let scaleX = 1;
    let groupX = groupOrigin.x;
    let groupWidth = groupOrigin.width;
    if (movesLeft || movesRight) {
      let naiveWidth = groupOrigin.width;
      if (movesLeft) naiveWidth = groupOrigin.width - dx;
      if (movesRight) naiveWidth = groupOrigin.width + dx;
      scaleX = naiveWidth / groupOrigin.width;
      const minScaleX = Math.max(...sectionIds.map((id) => SECTION_MIN_WIDTH / (s.dragOriginRects![id]?.width ?? SECTION_MIN_WIDTH)));
      scaleX = Math.max(scaleX, minScaleX);
      groupWidth = groupOrigin.width * scaleX;
      groupX = movesLeft ? groupOrigin.x + groupOrigin.width - groupWidth : groupOrigin.x;
    }

    let scaleY = 1;
    let groupY = groupOrigin.y;
    let groupHeight = groupOrigin.height;
    if (movesTop || movesBottom) {
      let naiveHeight = groupOrigin.height;
      if (movesTop) naiveHeight = groupOrigin.height - dy;
      if (movesBottom) naiveHeight = groupOrigin.height + dy;
      scaleY = naiveHeight / groupOrigin.height;
      const minScaleY = Math.max(...sectionIds.map((id) => SECTION_MIN_HEIGHT / (s.dragOriginRects![id]?.height ?? SECTION_MIN_HEIGHT)));
      scaleY = Math.max(scaleY, minScaleY);
      groupHeight = groupOrigin.height * scaleY;
      groupY = movesTop ? groupOrigin.y + groupOrigin.height - groupHeight : groupOrigin.y;
    }

    const proposed: Record<string, Rect> = {};
    for (const id of sectionIds) {
      const r = s.dragOriginRects[id];
      if (!r) continue;
      proposed[id] = {
        x: groupX + (r.x - groupOrigin.x) * scaleX,
        y: groupY + (r.y - groupOrigin.y) * scaleY,
        width: r.width * scaleX,
        height: r.height * scaleY,
      };
    }

    set({
      dragState: { ...s.dragState, current: point },
      resizePreviewRects: proposed,
    });
  },

  endSectionResize: () => {
    const s = get();
    if (s.dragState?.kind !== 'section-resize' || !s.resizePreviewRects) {
      set({ dragState: null, dragOriginRects: null, resizePreviewRects: null });
      return;
    }
    const { sectionIds } = s.dragState;
    const snap_ = snapshot(s);
    const newSections = { ...s.sections };
    const newScenes = { ...s.scenes };

    for (const id of sectionIds) {
      const newRect = s.resizePreviewRects[id];
      if (!newRect) continue;
      newSections[id] = { ...s.sections[id], ...newRect };
      for (const sc of Object.values(s.scenes)) {
        if (sc.sectionId === id && !isFullyInside(sc, newRect)) {
          newScenes[sc.id] = { ...sc, sectionId: null };
        }
      }
    }

    set({
      scenes: newScenes,
      sections: newSections,
      dragState: null,
      dragOriginRects: null,
      resizePreviewRects: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  // ---------------- section draw ----------------
  startSectionDraw: (origin) => {
    set({ dragState: { kind: 'section-draw', origin, current: origin }, drawPreviewRect: { x: origin.x, y: origin.y, width: 0, height: 0 } });
  },

  updateSectionDraw: (point) => {
    const s = get();
    if (s.dragState?.kind !== 'section-draw') return;
    const { origin } = s.dragState;
    const x = Math.min(origin.x, point.x);
    const y = Math.min(origin.y, point.y);
    const width = Math.abs(point.x - origin.x);
    const height = Math.abs(point.y - origin.y);
    // Sections can overlap freely now — no clamping against existing sections.
    set({ dragState: { ...s.dragState, current: point }, drawPreviewRect: { x, y, width, height } });
  },

  endSectionDraw: () => {
    const s = get();
    if (s.dragState?.kind !== 'section-draw' || !s.drawPreviewRect) {
      set({ dragState: null, drawPreviewRect: null, tool: 'select' });
      return;
    }
    const { origin, current } = s.dragState;
    // origin is the fixed corner; the edge opposite it is the one that
    // should extend outward if the drawn rect is under the minimum size.
    const originIsRightEdge = current.x < origin.x;
    const originIsBottomEdge = current.y < origin.y;

    const rect = clampMinSize(s.drawPreviewRect, SECTION_MIN_WIDTH, SECTION_MIN_HEIGHT, {
      left: originIsRightEdge,
      top: originIsBottomEdge,
    });

    const snap_ = snapshot(s);
    const id = makeId('section');
    const name = nextSectionName(s.sections);
    const newSection: SectionModel = { id, name, nameTagVisible: false, ...rect };

    // Loose scenes the drawn rect fully encloses join immediately — same as
    // sweeping an existing section over them (endSectionMove) — instead of
    // needing a follow-up interaction to pick them up.
    const newScenes = { ...s.scenes };
    for (const sc of Object.values(s.scenes)) {
      if (sc.sectionId !== null) continue;
      if (isFullyInside(sc, rect)) newScenes[sc.id] = { ...sc, sectionId: id };
    }

    set({
      scenes: newScenes,
      sections: { ...s.sections, [id]: newSection },
      sectionOrder: [...s.sectionOrder, id],
      selection: { sceneIds: [], sectionIds: [id] },
      dragState: null,
      drawPreviewRect: null,
      tool: 'select',
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  // ---------------- marquee ----------------
  startMarquee: (origin, additive) => {
    set({ dragState: { kind: 'marquee', origin, current: origin, additive } });
  },

  updateMarquee: (point) =>
    set((s) => {
      if (s.dragState?.kind !== 'marquee') return {};
      return { dragState: { ...s.dragState, current: point } };
    }),

  endMarquee: () => {
    const s = get();
    if (s.dragState?.kind !== 'marquee') {
      set({ dragState: null });
      return;
    }
    const { origin, current, additive } = s.dragState;
    const x = Math.min(origin.x, current.x);
    const y = Math.min(origin.y, current.y);
    const width = Math.abs(current.x - origin.x);
    const height = Math.abs(current.y - origin.y);
    const marqueeRect: Rect = { x, y, width, height };

    if (width < 2 && height < 2) {
      // treat as a click on empty canvas
      set({ dragState: null, selection: additive ? s.selection : { sceneIds: [], sectionIds: [] } });
      return;
    }

    const hitScenes = Object.values(s.scenes)
      .filter((sc) => rectsIntersect(sc, marqueeRect))
      .map((sc) => sc.id);
    const hitSections = Object.values(s.sections)
      .filter((sec) => isFullyInside(sec, marqueeRect))
      .map((sec) => sec.id);

    const sceneIds = additive ? Array.from(new Set([...s.selection.sceneIds, ...hitScenes])) : hitScenes;
    const sectionIds = additive ? Array.from(new Set([...s.selection.sectionIds, ...hitSections])) : hitSections;
    set({
      dragState: null,
      selection: { sceneIds, sectionIds },
    });
  },

  cancelDrag: () => set({ dragState: null, dragOriginRects: null, dragOriginScenePositions: null, drawPreviewRect: null, resizePreviewRects: null }),

  // ---------------- section ops ----------------
  wrapSelectionIntoSection: () => {
    const s = get();
    const selected = s.selection.sceneIds.map((id) => s.scenes[id]).filter(Boolean) as SceneModel[];
    if (selected.length === 0) return;
    const bbox = boundingBox(selected);
    const rect = computeWrapRect(bbox, chromeAwarePadding(s.debug.wrapPadding, s.viewport.zoom));

    const snap_ = snapshot(s);
    const id = makeId('section');
    const name = nextSectionName(s.sections);
    const newSection: SectionModel = { id, name, nameTagVisible: false, ...rect };

    const newScenes = { ...s.scenes };
    for (const sc of selected) newScenes[sc.id] = { ...sc, sectionId: id };

    set({
      scenes: newScenes,
      sections: { ...s.sections, [id]: newSection },
      sectionOrder: [...s.sectionOrder, id],
      selection: { sceneIds: [], sectionIds: [id] },
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  beginRenameSection: (id) => set({ renamingSectionId: id, selection: { sceneIds: [], sectionIds: [id] } }),

  commitRenameSection: (id, name) => {
    const s = get();
    const current = s.sections[id];
    if (!current) {
      set({ renamingSectionId: null });
      return;
    }
    const trimmed = name.trim();
    // An empty commit hides the canvas name tag again (icon-only) — it
    // does NOT blank the underlying name, which the layer/debug panels
    // still display regardless of this flag.
    if (!trimmed) {
      if (!current.nameTagVisible) {
        set({ renamingSectionId: null });
        return;
      }
      const snap_ = snapshot(s);
      set({
        sections: { ...s.sections, [id]: { ...current, nameTagVisible: false } },
        renamingSectionId: null,
        undoStack: [...s.undoStack, snap_],
        redoStack: [],
      });
      return;
    }
    if (trimmed === current.name && current.nameTagVisible) {
      set({ renamingSectionId: null });
      return;
    }
    const snap_ = snapshot(s);
    set({
      sections: { ...s.sections, [id]: { ...current, name: trimmed.slice(0, 60), nameTagVisible: true } },
      renamingSectionId: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  cancelRenameSection: () => set({ renamingSectionId: null }),

  deleteSectionBoundary: (ids) => {
    const s = get();
    const idSet = new Set(ids.filter((id) => s.sections[id]));
    if (idSet.size === 0) return;
    const snap_ = snapshot(s);
    const newSections = { ...s.sections };
    for (const id of idSet) delete newSections[id];
    const newScenes = { ...s.scenes };
    for (const sc of Object.values(s.scenes)) {
      if (sc.sectionId && idSet.has(sc.sectionId)) newScenes[sc.id] = { ...sc, sectionId: null };
    }
    set({
      scenes: newScenes,
      sections: newSections,
      sectionOrder: s.sectionOrder.filter((sid) => !idSet.has(sid)),
      selection: { sceneIds: s.selection.sceneIds, sectionIds: s.selection.sectionIds.filter((sid) => !idSet.has(sid)) },
      contextMenu: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  dissolveSection: (ids) => get().deleteSectionBoundary(ids),

  deleteSectionWithContents: (ids) => {
    const s = get();
    const idSet = new Set(ids.filter((id) => s.sections[id]));
    if (idSet.size === 0) return;
    const memberIds = new Set<string>();
    for (const id of idSet) {
      for (const m of membersOfSection(id, s.scenes)) memberIds.add(m.id);
    }
    const snap_ = snapshot(s);
    const newScenes = { ...s.scenes };
    for (const mid of memberIds) delete newScenes[mid];
    const newSections = { ...s.sections };
    for (const id of idSet) delete newSections[id];
    set({
      scenes: newScenes,
      sceneOrder: s.sceneOrder.filter((sid) => !memberIds.has(sid)),
      sections: newSections,
      sectionOrder: s.sectionOrder.filter((sid) => !idSet.has(sid)),
      selection: { sceneIds: [], sectionIds: [] },
      contextMenu: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  duplicateSection: (ids) => {
    const s = get();
    const targets = ids.map((id) => s.sections[id]).filter((sec): sec is SectionModel => Boolean(sec));
    if (targets.length === 0) return;
    const offset = 24;

    const snap_ = snapshot(s);
    const newScenes = { ...s.scenes };
    const newSceneIds: string[] = [];
    const newSections = { ...s.sections };
    const newSectionIds: string[] = [];

    for (const section of targets) {
      const members = membersOfSection(section.id, s.scenes);
      const candidate = translateRect(section, offset, offset);
      const newSectionId = makeId('section');
      newSections[newSectionId] = {
        id: newSectionId,
        name: `${section.name} copy`,
        nameTagVisible: section.nameTagVisible,
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
      };
      newSectionIds.push(newSectionId);
      for (const m of members) {
        const nid = makeId('scene');
        newScenes[nid] = { ...m, id: nid, x: m.x + offset, y: m.y + offset, sectionId: newSectionId };
        newSceneIds.push(nid);
      }
    }

    set({
      scenes: newScenes,
      sceneOrder: [...s.sceneOrder, ...newSceneIds],
      sections: newSections,
      sectionOrder: [...s.sectionOrder, ...newSectionIds],
      selection: { sceneIds: [], sectionIds: newSectionIds },
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  copySection: (ids) => {
    const s = get();
    const targets = ids.map((id) => s.sections[id]).filter((sec): sec is SectionModel => Boolean(sec));
    if (targets.length === 0) return;
    sectionClipboard = targets.map((section) => ({
      section: { ...section },
      members: membersOfSection(section.id, s.scenes).map((m) => ({ ...m })),
    }));
  },

  pasteSection: () => {
    if (!sectionClipboard || sectionClipboard.length === 0) return;
    const s = get();
    const offset = 32;

    const snap_ = snapshot(s);
    const newScenes = { ...s.scenes };
    const newSceneIds: string[] = [];
    const newSections = { ...s.sections };
    const newSectionIds: string[] = [];

    for (const { section, members } of sectionClipboard) {
      const candidate = translateRect(section, offset, offset);
      const newSectionId = makeId('section');
      newSections[newSectionId] = {
        id: newSectionId,
        name: `${section.name} copy`,
        nameTagVisible: section.nameTagVisible,
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
      };
      newSectionIds.push(newSectionId);
      for (const m of members) {
        const nid = makeId('scene');
        newScenes[nid] = { ...m, id: nid, x: m.x + offset, y: m.y + offset, sectionId: newSectionId };
        newSceneIds.push(nid);
      }
    }

    set({
      scenes: newScenes,
      sceneOrder: [...s.sceneOrder, ...newSceneIds],
      sections: newSections,
      sectionOrder: [...s.sectionOrder, ...newSectionIds],
      selection: { sceneIds: [], sectionIds: newSectionIds },
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  bringSectionToFront: (ids) => {
    const s = get();
    const idSet = new Set(ids.filter((id) => s.sections[id]));
    if (idSet.size === 0) return;
    const order = s.sectionOrder;
    // Preserve each target's relative order among the targets, and each
    // untouched section's relative order among the rest.
    const rest = order.filter((sid) => !idSet.has(sid));
    const targets = order.filter((sid) => idSet.has(sid));
    const newOrder = [...rest, ...targets];
    if (newOrder.every((id, i) => id === order[i])) return;
    const snap_ = snapshot(s);
    set({
      sectionOrder: newOrder,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  sendSectionToBack: (ids) => {
    const s = get();
    const idSet = new Set(ids.filter((id) => s.sections[id]));
    if (idSet.size === 0) return;
    const order = s.sectionOrder;
    const targets = order.filter((sid) => idSet.has(sid));
    const rest = order.filter((sid) => !idSet.has(sid));
    const newOrder = [...targets, ...rest];
    if (newOrder.every((id, i) => id === order[i])) return;
    const snap_ = snapshot(s);
    set({
      sectionOrder: newOrder,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  deleteScenes: (ids) => {
    const s = get();
    const idSet = new Set(ids.filter((id) => s.scenes[id]));
    if (idSet.size === 0) return;
    const snap_ = snapshot(s);

    const affectedSectionIds = new Set<string>();
    for (const id of idSet) {
      const sc = s.scenes[id];
      if (sc?.sectionId) affectedSectionIds.add(sc.sectionId);
    }

    const newScenes = { ...s.scenes };
    for (const id of idSet) delete newScenes[id];

    // Any section that lost a member re-fits to its remaining members + the
    // same padding used when a section is created to wrap scenes (wrap
    // padding, not grow padding) — only edges with newly-created slack pull
    // inward, so removing an interior scene (bbox unchanged) never shrinks
    // anything.
    const newSections = { ...s.sections };
    let shrunkSectionId: string | null = null;
    for (const sectionId of affectedSectionIds) {
      const section = newSections[sectionId];
      if (!section) continue;
      const remaining = Object.values(newScenes).filter((sc) => sc.sectionId === sectionId);
      const shrunk = computeAutoShrink(section, remaining, chromeAwarePadding(s.debug.wrapPadding, s.viewport.zoom), SECTION_MIN_WIDTH, SECTION_MIN_HEIGHT);
      if (shrunk.x !== section.x || shrunk.y !== section.y || shrunk.width !== section.width || shrunk.height !== section.height) {
        newSections[sectionId] = { ...section, ...shrunk };
        if (!shrunkSectionId) shrunkSectionId = sectionId;
      }
    }

    if (shrunkSectionId) {
      if (growTimer) clearTimeout(growTimer);
      growTimer = setTimeout(() => set({ growingSectionId: null }), s.debug.growDuration + 20);
    }

    set({
      scenes: newScenes,
      sceneOrder: s.sceneOrder.filter((id) => !idSet.has(id)),
      sections: newSections,
      selection: { sceneIds: [], sectionIds: [] },
      growingSectionId: shrunkSectionId,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  generateVariations: (sceneId) => {
    const s = get();
    const scene = s.scenes[sceneId];
    if (!scene || !scene.sectionId) return; // only defined for a scene inside a section
    const section = s.sections[scene.sectionId];
    if (!section) return;

    const snap_ = snapshot(s);
    const { width: w, height: h } = scene;
    // VARIATION_GAP is the desired visual gap between each new scene's
    // hover/selection outline, not its bare frame — sceneOutlineGap adds in
    // the label/menu-button chrome and the outline's own padding (all fixed
    // screen-px, see SceneOverlayLayer's scene-hover-wrap), converted through
    // the current zoom, same technique as chromeAwarePadding. Without this,
    // a small raw gap left neighboring outlines overlapping.
    const { horizontal: colGap, vertical: rowGap } = sceneOutlineGap(VARIATION_GAP, s.viewport.zoom);
    const startX = scene.x; // left-aligned with the source scene, not centered
    let startY = scene.y + h + rowGap;

    // If the row right below the source scene is already occupied by another
    // scene, drop the new row below every existing scene instead — simplest
    // way to guarantee empty space without a full bin-packing search.
    const rowWidth = w * 4 + colGap * 3;
    const proposedRow = { x: startX, y: startY, width: rowWidth, height: h };
    const otherScenes = Object.values(s.scenes).filter((sc) => sc.id !== sceneId);
    if (otherScenes.some((sc) => rectsIntersect(proposedRow, sc))) {
      const maxBottom = Math.max(scene.y + h, ...otherScenes.map((sc) => sc.y + sc.height));
      startY = maxBottom + rowGap;
    }

    const offsets = [
      { x: 0, y: 0 },
      { x: w + colGap, y: 0 },
      { x: (w + colGap) * 2, y: 0 },
      { x: (w + colGap) * 3, y: 0 },
    ];

    const newScenes = { ...s.scenes };
    const newSceneIds: string[] = [];
    offsets.forEach((off, i) => {
      const nid = makeId('scene');
      newScenes[nid] = {
        id: nid,
        name: `Variation ${i + 1}`,
        x: startX + off.x,
        y: startY + off.y,
        width: w,
        height: h,
        color: SCENE_COLOR,
        image: randomImage(),
        sectionId: section.id,
      };
      newSceneIds.push(nid);
    });

    const newScenesBbox = boundingBox(newSceneIds.map((id) => newScenes[id]));
    const grownRect = growToContain(section, newScenesBbox, chromeAwarePadding(s.debug.growPadding, s.viewport.zoom));

    if (growTimer) clearTimeout(growTimer);
    growTimer = setTimeout(() => set({ growingSectionId: null }), s.debug.growDuration + 20);

    set({
      scenes: newScenes,
      sceneOrder: [...s.sceneOrder, ...newSceneIds],
      sections: { ...s.sections, [section.id]: { ...section, ...grownRect } },
      growingSectionId: section.id,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  createSceneAt: (point) => {
    const s = get();
    const snap_ = snapshot(s);
    const id = makeId('scene');
    const newScene: SceneModel = {
      id,
      name: nextSceneName(s.scenes),
      x: point.x - SCENE_SIZE / 2,
      y: point.y - SCENE_SIZE / 2,
      width: SCENE_SIZE,
      height: SCENE_SIZE,
      color: SCENE_COLOR,
      image: randomImage(),
      sectionId: null,
    };
    set({
      scenes: { ...s.scenes, [id]: newScene },
      sceneOrder: [...s.sceneOrder, id],
      selection: { sceneIds: [id], sectionIds: [] },
      contextMenu: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  createSectionAt: (point) => {
    const s = get();
    const snap_ = snapshot(s);
    const id = makeId('section');
    const rect: Rect = {
      x: point.x - SECTION_MIN_WIDTH / 2,
      y: point.y - SECTION_MIN_HEIGHT / 2,
      width: SECTION_MIN_WIDTH,
      height: SECTION_MIN_HEIGHT,
    };
    const newSection: SectionModel = { id, name: nextSectionName(s.sections), nameTagVisible: false, ...rect };

    const newScenes = { ...s.scenes };
    for (const sc of Object.values(s.scenes)) {
      if (sc.sectionId !== null) continue;
      if (isFullyInside(sc, rect)) newScenes[sc.id] = { ...sc, sectionId: id };
    }

    set({
      scenes: newScenes,
      sections: { ...s.sections, [id]: newSection },
      sectionOrder: [...s.sectionOrder, id],
      selection: { sceneIds: [], sectionIds: [id] },
      contextMenu: null,
      undoStack: [...s.undoStack, snap_],
      redoStack: [],
    });
  },

  openSectionContextMenu: (x, y, sectionId) => set({ contextMenu: { kind: 'section', x, y, sectionId } }),
  openSceneContextMenu: (x, y) => set({ contextMenu: { kind: 'scene', x, y } }),
  openCanvasContextMenu: (x, y, world) => set({ contextMenu: { kind: 'canvas', x, y, world } }),
  closeContextMenu: () => set({ contextMenu: null }),

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },

  undo: () => {
    const s = get();
    if (s.undoStack.length === 0) return;
    const prev = s.undoStack[s.undoStack.length - 1];
    const redoSnap = snapshot(s);
    set({
      scenes: prev.scenes,
      sections: prev.sections,
      sceneOrder: prev.sceneOrder,
      sectionOrder: prev.sectionOrder,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, redoSnap],
      selection: { sceneIds: [], sectionIds: [] },
    });
  },

  redo: () => {
    const s = get();
    if (s.redoStack.length === 0) return;
    const next = s.redoStack[s.redoStack.length - 1];
    const undoSnap = snapshot(s);
    set({
      scenes: next.scenes,
      sections: next.sections,
      sceneOrder: next.sceneOrder,
      sectionOrder: next.sectionOrder,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, undoSnap],
      selection: { sceneIds: [], sectionIds: [] },
    });
  },

  setHoveredSection: (id) => set({ hoveredSectionId: id }),
  setHoveredScene: (id) => set({ hoveredSceneId: id }),
  setDebugShowBounds: (v) => set((s) => ({ debug: { ...s.debug, showBounds: v } })),
  setGrowPadding: (v) => set((s) => ({ debug: { ...s.debug, growPadding: v } })),
  setGrowDuration: (v) => set((s) => ({ debug: { ...s.debug, growDuration: v } })),
  setWrapPadding: (v) => set((s) => ({ debug: { ...s.debug, wrapPadding: v } })),
  setAutoPickColor: (v) => set((s) => ({ debug: { ...s.debug, autoPickColor: v } })),
  setSectionBorderColor: (v) => set((s) => ({ debug: { ...s.debug, sectionBorderColor: v } })),
  setSectionIconColor: (v) => set((s) => ({ debug: { ...s.debug, sectionIconColor: v } })),
}));
