import { useRef } from 'react';
import { useDrawingStore, type StrokeMode } from '../store';
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
        strokeMode: store.strokeMode,
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
        if (data.canvasState.strokeMode !== undefined) {
          store.setStrokeMode(data.canvasState.strokeMode);
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

  const handleStrokeModeChange = (mode: StrokeMode) => {
    store.setStrokeMode(mode);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${store.mode === 'select' ? 'toolbar-btn-active' : ''}`}
          onClick={() => {
            store.setMode('select');
            store.setDigitalMode('select');
          }}
          title="Select mode (V)"
        >
          Select
        </button>
        <button
          className={`toolbar-btn ${store.mode === 'draw' ? 'toolbar-btn-active' : ''}`}
          onClick={() => {
            store.setMode('draw');
            if (store.toolCategory === 'digital') {
              store.setDigitalMode('draw');
            }
          }}
          title="Draw mode (D)"
        >
          Draw
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group drawing-mode-group">
        <span className="mode-label">Brush:</span>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${store.strokeMode === 'original' ? 'active' : ''}`}
            onClick={() => handleStrokeModeChange('original')}
            title="Draw with original strokes (no processing)"
          >
            Original
          </button>
          <button
            className={`mode-btn ${store.strokeMode === 'smooth' ? 'active' : ''}`}
            onClick={() => handleStrokeModeChange('smooth')}
            title="Smooth strokes while preserving curves"
          >
            Smooth
          </button>
          <button
            className={`mode-btn ${store.strokeMode === 'predict' ? 'active' : ''}`}
            onClick={() => handleStrokeModeChange('predict')}
            title="Recognize and perfect geometric shapes"
          >
            Predict
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Undo Predict button - only show when in predict mode and there's data to restore */}
      {store.strokeMode === 'predict' && store.lastStrokeOriginalData && (
        <>
          <button
            className="toolbar-btn toolbar-btn-warning"
            onClick={() => {
              const success = store.undoLastPredict();
              if (success) {
                console.log('Prediction undone - restored to original stroke');
              }
            }}
            title="Undo last prediction and restore original stroke"
          >
            Undo Predict
          </button>
          <div className="toolbar-divider" />
        </>
      )}

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
        Mode: <span>{store.mode === 'select' ? 'Select' : 'Draw'}</span> | Zoom: <span>{(store.zoom * 100).toFixed(0)}%</span> | Strokes: <span>{store.strokes.length}</span>
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
