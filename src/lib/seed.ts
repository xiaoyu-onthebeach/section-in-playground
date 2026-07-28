import type { CanvasSnapshot, SceneModel, SectionModel } from '../types';
import { makeId } from './id';
import {
  SCENE_COLOR,
  SCENE_IMAGES,
  SCENE_SIZE,
  VARIATION_GAP,
  SCENE_LABEL_CHROME_HEIGHT,
  SCENE_MENU_CHROME_HEIGHT,
  SCENE_HOVER_WRAP_PADDING,
  DEFAULT_ZOOM,
} from './constants';

/**
 * Every scenario's geometry below was hand-tuned at a 2048px scene size
 * (section margins, capture slack, "must be bigger than a scene" sizing,
 * etc.) — `k` re-derives it proportionally whenever SCENE_SIZE changes, so
 * a scene-size tweak doesn't silently break a scenario's intended fit.
 */
const k = SCENE_SIZE / 2048;
const s = (v: number) => Math.round(v * k);

export function randomImage(): string {
  return SCENE_IMAGES[Math.floor(Math.random() * SCENE_IMAGES.length)];
}

function scene(name: string, x: number, y: number, sectionId: string | null = null): SceneModel {
  return {
    id: makeId('scene'),
    name,
    x,
    y,
    width: SCENE_SIZE,
    height: SCENE_SIZE,
    color: SCENE_COLOR,
    image: randomImage(),
    sectionId,
  };
}

function section(name: string, x: number, y: number, width: number, height: number): SectionModel {
  return { id: makeId('section'), name, nameTagVisible: false, x, y, width, height };
}

function snapshotOf(scenes: SceneModel[], sections: SectionModel[] = []): CanvasSnapshot {
  const sceneMap: Record<string, SceneModel> = {};
  const sectionMap: Record<string, SectionModel> = {};
  for (const sc of scenes) sceneMap[sc.id] = sc;
  for (const sec of sections) sectionMap[sec.id] = sec;
  return {
    scenes: sceneMap,
    sections: sectionMap,
    sceneOrder: scenes.map((sc) => sc.id),
    sectionOrder: sections.map((sec) => sec.id),
  };
}

/**
 * ~12 pre-seeded square scenes in a staggered grid: row 0 sits in columns
 * 0-3, rows 1-2 shift one column right (columns 1-4) — a staircase rather
 * than a plain grid.
 */
export function createDefaultSnapshot(): CanvasSnapshot {
  // VARIATION_GAP (24px) is the desired visual gap between each scene's
  // hover/selection outline, not the bare image frame — so it has to add in
  // the label/menu-button chrome and the outline's own padding, all fixed
  // screen-px regardless of zoom (see SceneOverlayLayer's scene-hover-wrap).
  // Converting those through DEFAULT_ZOOM — the zoom this scenario loads at —
  // turns them into the matching world-space allowance, same technique as
  // chromeAwarePadding. Row gap needs both the label chrome above AND the
  // menu-button chrome below (stacked rows), so it's taller than the column
  // gap, which only needs the outline's side padding.
  const gapWorld = VARIATION_GAP / DEFAULT_ZOOM;
  const outlineSide = SCENE_HOVER_WRAP_PADDING / DEFAULT_ZOOM;
  const outlineTop = (SCENE_LABEL_CHROME_HEIGHT + SCENE_HOVER_WRAP_PADDING) / DEFAULT_ZOOM;
  const outlineBottom = (SCENE_MENU_CHROME_HEIGHT + SCENE_HOVER_WRAP_PADDING) / DEFAULT_ZOOM;

  const colStride = Math.round(SCENE_SIZE + gapWorld + 2 * outlineSide);
  const rowStride = Math.round(SCENE_SIZE + gapWorld + outlineTop + outlineBottom);
  const cols = 4;
  const scenes: SceneModel[] = Array.from({ length: 12 }, (_, i) => {
    const row = Math.floor(i / cols);
    const indexInRow = i % cols;
    const colOffset = row === 0 ? 0 : 1;
    const col = indexInRow + colOffset;
    return scene(`Scene ${i + 1}`, col * colStride, row * rowStride);
  });
  return snapshotOf(scenes);
}

export const SCENARIOS: { id: string; name: string; description: string; build: () => CanvasSnapshot }[] = [
  {
    id: 'default',
    name: 'Default (12 scenes)',
    description: 'Seeded scattered scenes, no sections.',
    build: createDefaultSnapshot,
  },
  {
    id: 'overlap-growth',
    name: '2. Overlap on growth',
    description: 'Dropping a bridging scene grows Section 1 into Section 2 — allowed, and Section 2 keeps its own member.',
    build: () => {
      // Sections must be bigger than a scene (with margin) to hold a real member — reuses the "escape" scenario's proven sizing.
      const sec1 = section('Section 1', s(200), s(200), s(2600), s(2600));
      const sec2 = section('Section 2', s(3000), s(200), s(2600), s(2600)); // 200px gap before growth
      const memberX = scene('Member X', s(380), s(380), sec1.id);
      const memberY = scene('Member Y', s(3180), s(380), sec2.id);
      // Overlaps Section 1 far more than Section 2, so Section 1 wins and grows into Section 2's space.
      const bridging = scene('Bridge', s(1200), s(200));
      const filler = [scene('Scene Z', s(1200), s(3600))];
      return snapshotOf([memberX, memberY, bridging, ...filler], [sec1, sec2]);
    },
  },
];
