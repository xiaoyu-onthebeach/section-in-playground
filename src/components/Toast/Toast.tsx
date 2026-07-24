import { useCanvasStore } from '../../store/canvasStore';
import './Toast.css';

export function Toast() {
  const toast = useCanvasStore((s) => s.toast);
  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}
