export const SECTION_MIN_WIDTH = 200;
export const SECTION_MIN_HEIGHT = 150;

/** All mock scenes are square at this size. */
export const SCENE_SIZE = 1024;

export const WRAP_PADDING_DEFAULT = 48;
export const WRAP_PADDING_MIN = 8;
/** Debug panel's "Wrap padding" slider bounds. */
export const WRAP_PADDING_SLIDER_MIN = 24;
export const WRAP_PADDING_SLIDER_MAX = 100;

export const DEFAULT_GROW_PADDING = 24;
export const DEFAULT_GROW_DURATION = 180;

/** Gap between a double-clicked scene's generated variations, and between them and the source scene. */
export const VARIATION_GAP = 4;

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;

/** At or below this zoom, scene names/menu icons and section header chips hide — too small to read, and cluttering a fully-zoomed-out view. */
export const CHROME_HIDE_ZOOM_THRESHOLD = 0.1;

/** Zoom level used when framing content on load / scenario reset — true 30%, not auto-fit. */
export const DEFAULT_ZOOM = 0.3;

export const SECTION_BORDER_BAND = 8;

/** Section corner radius, a literal fixed screen-px value regardless of zoom — same "always renders as the same number" rationale as border width. */
export const SECTION_BORDER_RADIUS = 24;
/** Corner radius for the in-progress "drawing a new section" preview, same fixed-screen-px rationale. */
export const DRAW_PREVIEW_BORDER_RADIUS = 12;

/**
 * Fixed screen-px footprint of each scene's chrome (SceneOverlayLayer),
 * which lives outside the zoomed canvas and never scales with it — the
 * scene name label above the frame (~14px*1.4 line-height + 6px gap), and
 * the "..." menu button below it (6px gap + 16px button). Sections that
 * grow/wrap/shrink around scenes divide these by the current zoom to add
 * the matching world-space padding on top/bottom, so the chrome stays
 * visually inside the boundary too, not just the bare scene frame.
 */
export const SCENE_LABEL_CHROME_HEIGHT = 26;
export const SCENE_MENU_CHROME_HEIGHT = 22;

/** Extra breathing room (fixed screen-px) around the label+frame+menu-button union for the hover wrap-outline in SceneOverlayLayer. */
export const SCENE_HOVER_WRAP_PADDING = 16;

/** Default (non-auto-pick) section fill — #26262C, as an "R, G, B" triplet so it composes with SECTION_BG_OPACITY into `rgba(...)`. */
export const SECTION_EMPTY_BG_RGB = '38, 38, 44';
/** Section fill opacity (80%). When auto-pick is on and a section has a member, its fill switches to a color sampled from that scene's image (see lib/imageColor.ts), at this same opacity. */
export const SECTION_BG_OPACITY = 0.8;

/** Fallback background behind each scene's image (shows through while it loads). */
export const SCENE_COLOR = '#40404A';

/** Defaults for the debug panel's section-appearance overrides — resting (non-selected, non-highlighted) look only; selection/highlight feedback colors stay hardwired. */
export const SECTION_BORDER_COLOR_DEFAULT = '#40404A';
export const SECTION_ICON_COLOR_DEFAULT = '#ffffff';

/** Pool of mock "generated" images — one is randomly assigned to each seeded scene. */
export const SCENE_IMAGES = [
  '/images/blue_3.png',
  '/images/blue_3_1.png',
  '/images/blue_3_2.png',
  '/images/blue_3_3.png',
  '/images/blue_3_4.png',
  '/images/blue_3_5.png',
  '/images/blue_3_6.png',
];
