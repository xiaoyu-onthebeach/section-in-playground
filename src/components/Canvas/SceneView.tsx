import { useCanvasStore } from '../../store/canvasStore';
import type { SceneModel } from '../../types';
import { useScenePosition } from '../../hooks/useDerivedState';
import { useCanvasOrigin } from '../../canvas/CanvasOriginContext';
import './SceneView.css';

interface Props {
  scene: SceneModel;
  isSelected: boolean;
  isLeaving: boolean;
  isCapturePreview: boolean;
  /** Sits (geometrically) inside a section's bounds without being one of its members — tinted to look like the section is drawn over it, instead of looking like an unaffected scene sitting on top of the section. */
  isTrapped?: boolean;
}

export function SceneView({ scene, isSelected, isLeaving, isCapturePreview, isTrapped }: Props) {
  const pos = useScenePosition(scene);
  const tool = useCanvasStore((s) => s.tool);
  const beginScenePointerDown = useCanvasStore((s) => s.beginScenePointerDown);
  const updateSceneDrag = useCanvasStore((s) => s.updateSceneDrag);
  const endSceneDrag = useCanvasStore((s) => s.endSceneDrag);
  const selectScene = useCanvasStore((s) => s.selectScene);
  const openSceneContextMenu = useCanvasStore((s) => s.openSceneContextMenu);
  const generateVariations = useCanvasStore((s) => s.generateVariations);
  const { toWorld } = useCanvasOrigin();

  const isDragging = useCanvasStore(
    (s) => s.dragState?.kind === 'scene' && s.dragState.sceneIds.includes(scene.id)
  );
  const showBounds = useCanvasStore((s) => s.debug.showBounds);

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    const origin = toWorld(e.clientX, e.clientY);
    beginScenePointerDown(scene.id, e.shiftKey, origin);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    updateSceneDrag(toWorld(e.clientX, e.clientY));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    endSceneDrag();
  };

  const openMenu = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSelected) selectScene(scene.id, false);
    openSceneContextMenu(e.clientX, e.clientY);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select' || scene.sectionId === null) return;
    e.stopPropagation();
    generateVariations(scene.id);
  };

  return (
    <div
      data-scene-name={scene.name}
      className={[
        'scene',
        isSelected && 'scene--selected',
        isDragging && 'scene--dragging',
        isLeaving && 'scene--leaving',
        isCapturePreview && 'scene--capture-preview',
        isTrapped && 'scene--trapped',
        showBounds && 'scene--debug-bounds',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: pos.x, top: pos.y, width: scene.width, height: scene.height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={openMenu}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="scene__image"
        style={{
          backgroundColor: scene.color,
          backgroundImage: `url(${scene.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {isTrapped && <div className="scene__trapped-tint" />}
    </div>
  );
}
