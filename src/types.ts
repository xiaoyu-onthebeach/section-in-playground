export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SceneModel {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  /** Mock "generated" image shown in the scene's frame — randomly assigned at creation. */
  image: string;
  /**
   * Stored membership. Sections can now overlap, so "fully inside" is no
   * longer unambiguous (a scene can be geometrically inside two overlapping
   * sections at once) — the owning section is therefore an explicit field,
   * assigned only by discrete commit actions (drop, sweep-capture,
   * resize-escape), not re-derived from geometry on every read.
   */
  sectionId: string | null;
}

export interface SectionModel {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Whether the canvas label shows `name` as text next to the icon. Default-
   * generated names ("Section 1") stay icon-only; committing a name via the
   * icon-rename flow turns this on, committing an empty one turns it back
   * off — independent of `name` itself, which other UI (layer panel, debug
   * panel) always displays regardless of this flag.
   */
  nameTagVisible: boolean;
}

export type ToolId = 'select' | 'pan' | 'section';

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export interface Selection {
  sceneIds: string[];
  sectionIds: string[];
}

export interface CanvasSnapshot {
  scenes: Record<string, SceneModel>;
  sections: Record<string, SectionModel>;
  sceneOrder: string[];
  sectionOrder: string[];
}

export type ResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export type DragState =
  | { kind: 'scene'; sceneIds: string[]; origin: Point; current: Point; originSectionId: string | null }
  | { kind: 'section-move'; sectionIds: string[]; origin: Point; current: Point; memberIds: string[] }
  | { kind: 'section-resize'; sectionIds: string[]; handle: ResizeHandle; origin: Point; current: Point }
  | { kind: 'section-draw'; origin: Point; current: Point }
  | { kind: 'marquee'; origin: Point; current: Point; additive: boolean }
  | null;

export type ContextMenuState =
  | { kind: 'section'; x: number; y: number; sectionId: string }
  | { kind: 'scene'; x: number; y: number }
  | { kind: 'canvas'; x: number; y: number; world: Point }
  | null;
