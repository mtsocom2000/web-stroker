import { useEffect } from 'react';
import './App.css';
import { DrawingCanvas } from './components/DrawingCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import { DrawToolPanel } from './components/DrawToolPanel';
import { Toolbar } from './components/Toolbar';
import { useDrawingStore } from './store';

function App() {
  const store = useDrawingStore();

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        store.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        store.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
      } else if (e.key === 'v' || e.key === 'V') {
        store.setMode('select');
      } else if (e.key === 'd' || e.key === 'D') {
        store.setMode('draw');
      } else if (e.key === 'Escape') {
        store.clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  return (
    <div className="app">
      <Toolbar />
      <PropertyPanel />
      <DrawToolPanel />
      <DrawingCanvas />
    </div>
  );
}

export default App;
