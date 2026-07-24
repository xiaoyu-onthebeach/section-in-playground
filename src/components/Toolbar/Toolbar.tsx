import { useCanvasStore } from '../../store/canvasStore';
import { AnnotateIcon, CursorIcon, HandIcon, SectionIcon } from './icons';
import './Toolbar.css';

export function Toolbar() {
  const tool = useCanvasStore((s) => s.tool);
  const setTool = useCanvasStore((s) => s.setTool);
  const showToast = useCanvasStore((s) => s.showToast);

  return (
    <div className="toolbar">
      <button
        className={`toolbar__btn ${tool === 'select' ? 'toolbar__btn--active' : ''}`}
        onClick={() => setTool('select')}
        title="Select (V)"
      >
        <CursorIcon />
      </button>
      <button
        className={`toolbar__btn ${tool === 'pan' ? 'toolbar__btn--active' : ''}`}
        onClick={() => setTool('pan')}
        title="Pan (H, or hold Space)"
      >
        <HandIcon />
      </button>
      <button
        className="toolbar__btn"
        onClick={() => showToast('Annotate — not implemented in this prototype')}
        title="Annotate (not implemented)"
      >
        <AnnotateIcon />
      </button>
      <div className="toolbar__item">
        <button
          className={`toolbar__btn ${tool === 'section' ? 'toolbar__btn--active' : ''}`}
          onClick={() => setTool('section')}
          title="Section (⌘G)"
        >
          <SectionIcon />
        </button>
        <div className="toolbar__tooltip">
          <div className="toolbar__tooltip-bubble">
            <span>Section</span>
            <span className="toolbar__tooltip-key">S</span>
          </div>
          <div className="toolbar__tooltip-tail" />
        </div>
      </div>
    </div>
  );
}
