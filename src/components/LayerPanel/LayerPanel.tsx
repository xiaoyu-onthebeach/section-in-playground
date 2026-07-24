import { useCanvasStore } from '../../store/canvasStore';
import type { SceneModel } from '../../types';
import './LayerPanel.css';

function swatchStyle(scene: SceneModel) {
  return {
    backgroundColor: scene.color,
    backgroundImage: `url(${scene.image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/** Flat list of every scene — no section grouping/nesting; membership isn't reflected here at all. */
export function LayerPanel() {
  const sceneOrder = useCanvasStore((s) => s.sceneOrder);
  const scenes = useCanvasStore((s) => s.scenes);
  const selection = useCanvasStore((s) => s.selection);
  const selectScene = useCanvasStore((s) => s.selectScene);

  return (
    <div className="layer-panel">
      <div className="layer-panel__header">
        <span className="layer-panel__title">SCENES</span>
        <span className="layer-panel__count">{sceneOrder.length}</span>
      </div>
      <div className="layer-panel__list">
        {sceneOrder.map((sceneId) => {
          const scene = scenes[sceneId];
          if (!scene) return null;
          return (
            <div
              key={sceneId}
              className={`layer-row layer-row--scene ${selection.sceneIds.includes(sceneId) ? 'layer-row--selected' : ''}`}
              onClick={() => selectScene(sceneId, false)}
            >
              <span className="layer-row__swatch" style={swatchStyle(scene)} />
              <span className="layer-row__text">{scene.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
