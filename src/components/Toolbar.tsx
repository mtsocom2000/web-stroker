import { useRef } from 'react';
import { useDrawingStore } from '../store';
import type { DrawingData } from '../types';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
  const store = useDrawingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const data: DrawingData = {
      version: '1.0.0',
      timestamp: Date.now(),
      canvasState: {
        strokes: store.strokes,
        canvasWidth: store.canvasWidth,
        canvasHeight: store.canvasHeight,
        zoom: store.zoom,
        panX: store.panX,
        panY: store.panY,
        predictEnabled: store.predictEnabled,
        smoothEnabled: store.smoothEnabled,
      },
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as DrawingData;
        
        // Clear all existing strokes first
        store.clearStrokes();
        
        // Add all strokes from file
        data.canvasState.strokes.forEach((stroke) => {
          store.addStroke(stroke);
        });

        store.setZoom(data.canvasState.zoom);
        store.setPan(data.canvasState.panX ?? 0, data.canvasState.panY ?? 0);
        if (data.canvasState.predictEnabled !== undefined) {
          store.setPredictEnabled(data.canvasState.predictEnabled);
        }
        if (data.canvasState.smoothEnabled !== undefined) {
          store.setSmoothEnabled(data.canvasState.smoothEnabled);
        }
        
        // Trigger a re-render of the canvas to update camera
        window.dispatchEvent(new Event('resize'));
      } catch (error) {
        console.error('Failed to load file:', error);
        alert('Failed to load drawing file. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <label htmlFor="color-picker">Color:</label>
        <input
          id="color-picker"
          type="color"
          value={store.currentColor}
          onChange={(e) => store.setColor(e.target.value)}
          className="color-picker"
        />
      </div>

      <div className="toolbar-group">
        <label htmlFor="brush-size">Brush Size:</label>
        <input
          id="brush-size"
          type="range"
          min="1"
          max="20"
          value={store.currentThickness}
          onChange={(e) => store.setThickness(parseInt(e.target.value))}
          className="slider"
        />
        <span className="thickness-value">{store.currentThickness}px</span>
      </div>

      <div className="toolbar-group">
        <label htmlFor="smooth-checkbox" title="Apply smoothing to freehand curves">
          <input
            id="smooth-checkbox"
            type="checkbox"
            checked={store.smoothEnabled}
            onChange={(e) => store.setSmoothEnabled(e.target.checked)}
          />
          {' '}Smooth
        </label>
      </div>

      <div className="toolbar-group">
        <label htmlFor="predict-checkbox" title="Simplify strokes to straight lines and shapes when possible">
          <input
            id="predict-checkbox"
            type="checkbox"
            checked={store.predictEnabled}
            onChange={(e) => store.setPredictEnabled(e.target.checked)}
          />
          {' '}Predict
        </label>
      </div>

      <div className="toolbar-divider" />

      <button
        className="toolbar-btn"
        onClick={handleSave}
        title="Save drawing (Ctrl+S)"
      >
        Save
      </button>

      <button
        type="button"
        className="toolbar-btn"
        onClick={handleLoadClick}
        title="Load drawing"
      >
        Load
      </button>

      <div className="toolbar-divider" />

      <button
        className="toolbar-btn"
        onClick={() => store.undo()}
        disabled={store.historyIndex <= 0}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>

      <button
        className="toolbar-btn"
        onClick={() => store.redo()}
        disabled={store.historyIndex >= store.history.length - 1}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>

      <div className="toolbar-divider" />

      <button
        className="toolbar-btn toolbar-btn-danger"
        onClick={() => store.clearStrokes()}
        title="Clear all strokes"
      >
        Clear
      </button>

      <div className="toolbar-info">
        Zoom: <span>{(store.zoom * 100).toFixed(0)}%</span> | Strokes: <span>{store.strokes.length}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        style={{ width: 0, height: 0, opacity: 0 }}
      />
    </div>
  );
};
