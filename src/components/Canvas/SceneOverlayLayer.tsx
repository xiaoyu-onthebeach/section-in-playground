import { useCanvasStore } from '../../store/canvasStore';
import { useActiveCaptureIds, useScenePosition, useVisuallyCoveredSceneIds } from '../../hooks/useDerivedState';
import { worldToScreen } from '../../lib/coords';
import { CHROME_HIDE_ZOOM_THRESHOLD, SCENE_HOVER_WRAP_PADDING, SCENE_LABEL_CHROME_HEIGHT, SCENE_MENU_CHROME_HEIGHT } from '../../lib/constants';
import type { SceneModel } from '../../types';
import './SceneOverlayLayer.css';

const BUTTON_SIZE = 16;
const BUTTON_GAP = 6; // screen px between the frame's bottom edge and the button, like the label's gap above

/**
 * Fixed-screen-size chrome for every scene — name label and the "..." menu
 * button — rendered in a screen-space overlay outside the zoomed canvas
 * transform, the same technique SectionLabelsLayer uses, so neither shrinks
 * away nor balloons as the user zooms.
 */
export function SceneOverlayLayer() {
  const sceneOrder = useCanvasStore((s) => s.sceneOrder);
  const scenes = useCanvasStore((s) => s.scenes);
  const { coveredIds } = useVisuallyCoveredSceneIds();
  const captureIds = useActiveCaptureIds();

  return (
    <div className="scene-overlay-layer">
      {sceneOrder.map((id) => {
        const scene = scenes[id];
        if (!scene) return null;
        return <SceneOverlayItem key={id} scene={scene} isCovered={coveredIds.has(id)} isCapturePreview={captureIds.has(id)} />;
      })}
    </div>
  );
}

function SceneOverlayItem({
  scene,
  isCovered,
  isCapturePreview,
}: {
  scene: SceneModel;
  isCovered: boolean;
  isCapturePreview: boolean;
}) {
  const pos = useScenePosition(scene);
  const viewport = useCanvasStore((s) => s.viewport);
  const isSelected = useCanvasStore((s) => s.selection.sceneIds.includes(scene.id));
  const isHovered = useCanvasStore((s) => s.hoveredSceneId === scene.id);
  const selectScene = useCanvasStore((s) => s.selectScene);
  const openSceneContextMenu = useCanvasStore((s) => s.openSceneContextMenu);

  const topLeft = worldToScreen(viewport, pos);
  const bottomRight = worldToScreen(viewport, { x: pos.x + scene.width, y: pos.y + scene.height });
  const maxWidth = Math.max(20, bottomRight.x - topLeft.x);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSelected) selectScene(scene.id, false);
    openSceneContextMenu(e.clientX, e.clientY);
  };

  const hideChrome = viewport.zoom <= CHROME_HIDE_ZOOM_THRESHOLD;

  return (
    <>
      {/* Outline wrapping the label above, the frame, and the menu button
          below, as one unit — shown on hover, stays while selected (this
          replaces the old inner border on the scene itself as the selected
          treatment), and also while the scene is a live capture-preview
          target of a section being dragged over it, so it reads as "about to
          join" the same way hovering it directly does. Sits in this same
          screen-space layer so its fixed-px padding/chrome-allowance never
          scales with zoom. */}
      {(isHovered || isSelected || isCapturePreview) && (
        <div
          className={['scene-hover-wrap', isSelected && 'scene-hover-wrap--selected'].filter(Boolean).join(' ')}
          style={{
            left: topLeft.x - SCENE_HOVER_WRAP_PADDING,
            top: topLeft.y - SCENE_LABEL_CHROME_HEIGHT - SCENE_HOVER_WRAP_PADDING,
            width: bottomRight.x - topLeft.x + SCENE_HOVER_WRAP_PADDING * 2,
            height: bottomRight.y - topLeft.y + SCENE_LABEL_CHROME_HEIGHT + SCENE_MENU_CHROME_HEIGHT + SCENE_HOVER_WRAP_PADDING * 2,
          }}
        />
      )}
      {!hideChrome && (
        <>
          {/* Sits above the frame, left-aligned to it — outside the scene, mirroring section labels. */}
          <span
            className={['scene-label', isCovered && 'scene-label--covered'].filter(Boolean).join(' ')}
            style={{ left: topLeft.x, top: topLeft.y, maxWidth }}
            title={scene.name.length > 28 ? scene.name : undefined}
          >
            {scene.name}
          </span>
          {/* Sits below the frame, right-aligned to it — outside the scene, mirroring the label's placement above. */}
          <button
            className={['scene-menu-btn', isCovered && 'scene-menu-btn--covered'].filter(Boolean).join(' ')}
            style={{ left: bottomRight.x - BUTTON_SIZE, top: bottomRight.y + BUTTON_GAP }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openMenu}
            onContextMenu={openMenu}
            aria-label="Scene options"
          >
            <MoreVerticalIcon />
          </button>
        </>
      )}
    </>
  );
}

function MoreVerticalIcon() {
  // Dot radius is deliberately large relative to the viewBox (vs. the more
  // common r=1 at this box size) — at a 12px render size, thin r=1 dots
  // anti-alias into near-invisible specks; this stays a crisp, legible glyph
  // that small.
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3.5" r="1.6" />
      <circle cx="8" cy="8" r="1.6" />
      <circle cx="8" cy="12.5" r="1.6" />
    </svg>
  );
}
