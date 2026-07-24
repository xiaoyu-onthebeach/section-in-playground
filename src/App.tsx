import { LayerPanel } from './components/LayerPanel/LayerPanel';
import { Canvas } from './components/Canvas/Canvas';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

export function App() {
  useKeyboardShortcuts();

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__brand">
          <span className="app-topbar__logo" />
          <span className="app-topbar__crumb">Sections</span>
          <span className="app-topbar__sep">/</span>
          <span className="app-topbar__crumb app-topbar__crumb--active">Interaction prototype</span>
        </div>
      </header>
      <div className="app-body">
        <LayerPanel />
        <Canvas />
      </div>
    </div>
  );
}
