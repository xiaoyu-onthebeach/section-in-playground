import { useCanvasStore } from '../../store/canvasStore';
import { DownloadIcon16, HideIcon16, RemoveIcon16, SectionIcon16 } from '../Toolbar/icons';
import './MultiSelectBar.css';

/** Floating bar shown above the canvas whenever one or more scenes are
 * selected — supersedes right-click as the primary way to wrap a selection
 * into a new section, and adds quick Remove/Hide/Download actions. */
export function MultiSelectBar() {
  const sceneIds = useCanvasStore((s) => s.selection.sceneIds);
  const wrapSelectionIntoSection = useCanvasStore((s) => s.wrapSelectionIntoSection);
  const deleteScenes = useCanvasStore((s) => s.deleteScenes);
  const showToast = useCanvasStore((s) => s.showToast);

  if (sceneIds.length < 2) return null;

  return (
    <div className="multi-select-bar">
      <div className="multi-select-bar__group">
        <button className="multi-select-bar__btn" onClick={() => wrapSelectionIntoSection()}>
          <SectionIcon16 />
          <span>Create new section</span>
        </button>
      </div>
      <div className="multi-select-bar__group">
        <button className="multi-select-bar__btn" onClick={() => deleteScenes(sceneIds)}>
          <RemoveIcon16 />
          <span>Remove</span>
        </button>
        <div className="multi-select-bar__divider" />
        <button
          className="multi-select-bar__btn"
          onClick={() => showToast('Hide — not implemented in this prototype')}
        >
          <HideIcon16 />
          <span>Hide</span>
        </button>
        <div className="multi-select-bar__divider" />
        <button
          className="multi-select-bar__btn"
          onClick={() => showToast('Download — not implemented in this prototype')}
        >
          <DownloadIcon16 />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}
