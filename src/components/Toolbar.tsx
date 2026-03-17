import { useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useDrawingStore, type StrokeMode } from '../store';
import type { DrawingData, Stroke } from '../types';
import './Toolbar.css';

// Speed options - simplified: N/A (instant), 0.5x, 5x
const SPEED_OPTIONS = [
  { value: 0, label: 'N/A' },      // Instant draw
  { value: 0.5, label: '0.5x' },  // Slow
  { value: 5, label: '5x' },      // Fast
];

export const Toolbar: React.FC = () => {
  const store = useDrawingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Animation replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(0); // Default N/A (instant)
  const [showReplayControls, setShowReplayControls] = useState(false);
  const [currentReplayStroke, setCurrentReplayStroke] = useState(0);
  const [totalReplayStrokes, setTotalReplayStrokes] = useState(0);
  const [isReplayDropdownOpen, setIsReplayDropdownOpen] = useState(false);
  const replayDataRef = useRef<DrawingData | null>(null);

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

  // Normal load - instant, no animation
  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  // Animation replay function
  const replayAnimation = useCallback(async (data: DrawingData, speed: number = 0, withPredict: boolean = false) => {
    if (!data.canvasState.strokes.length) return;
    
    setIsReplaying(true);
    setShowReplayControls(true);
    setTotalReplayStrokes(data.canvasState.strokes.length);
    setCurrentReplayStroke(0);
    
    // Enable animation replay mode only if speed > 0
    if (speed > 0) {
      store.setAnimationReplay(true);
    }
    
    // Clear existing strokes first
    store.clearStrokes();
    
    // Set canvas state
    store.setZoom(data.canvasState.zoom);
    store.setPan(data.canvasState.panX ?? 0, data.canvasState.panY ?? 0);
    if (data.canvasState.strokeMode !== undefined) {
      store.setStrokeMode(data.canvasState.strokeMode);
    }
    
    // Trigger resize for camera update
    window.dispatchEvent(new Event('resize'));
    
    // If speed is 0 (N/A), load instantly without animation
    if (speed === 0) {
      data.canvasState.strokes.forEach((stroke) => {
        store.addStroke(stroke);
      });
      store.setAnimationReplay(false);
      setIsReplaying(false);
      setCurrentReplayStroke(data.canvasState.strokes.length);
      return;
    }
    
    // Replay each stroke with animation
    for (let strokeIndex = 0; strokeIndex < data.canvasState.strokes.length; strokeIndex++) {
      setCurrentReplayStroke(strokeIndex + 1);
      const stroke = data.canvasState.strokes[strokeIndex];
      
      // Create a new stroke that will be built up point by point
      const animatedStroke: Stroke = {
        ...stroke,
        points: [],
        id: `${stroke.id}_replay`,
      };
      
      // Add the initial empty stroke
      store.addStroke(animatedStroke);
      
      // Get timestamps for this stroke's points
      const points = stroke.points;
      if (points.length === 0) continue;
      
      // Calculate delays based on actual timestamps
      const startTime = points[0].timestamp || 0;
      const delays: number[] = [];
      
      for (let i = 0; i < points.length; i++) {
        if (i === 0) {
          delays.push(0);
        } else {
          const prevTime = points[i - 1].timestamp || startTime;
          const currTime = points[i].timestamp || prevTime;
          const delay = (currTime - prevTime) / speed;
          delays.push(Math.min(delay, 50)); // Cap at 50ms for very dense points
        }
      }
      
      // Animate through points
      for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
        const updatedPoints = points.slice(0, pointIndex + 1);
        
        // Update the stroke with accumulated points using dedicated animation method
        // Use flushSync to force synchronous update so canvas renders immediately
        flushSync(() => {
          store.updateStrokePoints(animatedStroke.id, updatedPoints);
        });
        
        // Wait before adding next point
        if (pointIndex < points.length - 1) {
          const delay = Math.max(delays[pointIndex + 1], 10); // Minimum 10ms
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Run prediction if requested
      if (withPredict && store.strokeMode === 'predict') {
        // Trigger prediction for this stroke
        // This will be handled by the canvas component
      }
      
      // Small pause between strokes
      if (strokeIndex < data.canvasState.strokes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 / speed));
      }
    }
    
    // Disable animation replay mode when done
    store.setAnimationReplay(false);
    setIsReplaying(false);
  }, [store]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as DrawingData;
        replayDataRef.current = data;
        
        // Always use replay animation with current speed setting
        // If speed is 0 (N/A), it will load instantly
        replayAnimation(data, replaySpeed);
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

  const handleReplay = (withPredict: boolean = false) => {
    if (replayDataRef.current) {
      replayAnimation(replayDataRef.current, replaySpeed, withPredict);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setReplaySpeed(newSpeed);
  };

  const handleStopReplay = () => {
    store.setAnimationReplay(false);
    setIsReplaying(false);
    setShowReplayControls(false);
    setCurrentReplayStroke(0);
    setTotalReplayStrokes(0);
  };

  const handleStrokeModeChange = (mode: StrokeMode) => {
    store.setStrokeMode(mode);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${store.digitalMode === 'select' ? 'toolbar-btn-active' : ''}`}
          onClick={() => {
            store.setDigitalMode('select');
          }}
          title="Select mode (V)"
        >
          Select
        </button>
        <button
          className={`toolbar-btn ${store.digitalMode === 'draw' ? 'toolbar-btn-active' : ''}`}
          onClick={() => {
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

      {/* Simple Load Button */}
      <button
        type="button"
        className="toolbar-btn"
        onClick={handleLoad}
        title="Load drawing"
      >
        Load
      </button>

      <div className="toolbar-divider" />

      {/* Renderer Toggle - Phase 1: Feature flag for testing */}
      <div className="toolbar-group">
        <span className="mode-label">Renderer:</span>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${store.renderer === 'canvas2d' ? 'active' : ''}`}
            onClick={() => store.setRenderer('canvas2d')}
            title="Use Canvas 2D renderer (default)"
          >
            2D Canvas
          </button>
          <button
            className={`mode-btn ${store.renderer === 'threejs' ? 'active' : ''}`}
            onClick={() => store.setRenderer('threejs')}
            title="Use Three.js renderer (experimental, better performance)"
          >
            Three.js
          </button>
        </div>
      </div>

      {/* Replay Controls - always show when data is loaded */}
      {showReplayControls && (
        <>
          <div className="toolbar-divider" />
          <div className="toolbar-group replay-controls" style={{ 
            background: 'var(--surface-alt)', 
            padding: '4px 12px', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--divider)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Replay
            </span>
            
            {/* Progress - shows current stroke / total strokes */}
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', minWidth: '60px', textAlign: 'center' }}>
              {currentReplayStroke}/{totalReplayStrokes}
            </span>
            
            {/* Speed Control - only N/A, 0.5x, 5x */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Speed:</span>
              <select 
                value={replaySpeed} 
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                disabled={isReplaying}
                style={{
                  fontSize: '12px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--divider)',
                  background: 'var(--surface)',
                  cursor: isReplaying ? 'not-allowed' : 'pointer'
                }}
              >
                {SPEED_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            {/* Split Replay Button */}
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <button
                className="toolbar-btn"
                onClick={() => handleReplay(false)}
                disabled={isReplaying}
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                  borderRight: 'none',
                  opacity: isReplaying ? 0.5 : 1
                }}
                title="Replay animation"
              >
                {isReplaying ? 'Playing...' : 'Replay'}
              </button>
              <button
                className="toolbar-btn"
                onClick={() => setIsReplayDropdownOpen(!isReplayDropdownOpen)}
                disabled={isReplaying}
                style={{ 
                  padding: '4px 4px', 
                  fontSize: '12px',
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  opacity: isReplaying ? 0.5 : 1
                }}
                title="Replay options"
              >
                ▼
              </button>
            </div>
            
            {/* Replay Dropdown */}
            {isReplayDropdownOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--surface)',
                  border: '1px solid var(--divider)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 100,
                  minWidth: '140px'
                }}
              >
                <button
                  className="toolbar-btn"
                  onClick={() => {
                    setIsReplayDropdownOpen(false);
                    handleReplay(false);
                  }}
                  style={{
                    width: '100%',
                    borderRadius: 0,
                    border: 'none',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--divider)',
                    padding: '6px 12px'
                  }}
                >
                  Replay
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => {
                    setIsReplayDropdownOpen(false);
                    handleReplay(true);
                  }}
                  style={{
                    width: '100%',
                    borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                    border: 'none',
                    textAlign: 'left',
                    padding: '6px 12px'
                  }}
                >
                  Replay & Predict
                </button>
              </div>
            )}
            
            {/* Stop Button */}
            <button
              className="toolbar-btn toolbar-btn-danger"
              onClick={handleStopReplay}
              style={{ padding: '4px 8px', fontSize: '12px' }}
              title="Stop replay"
            >
              ✕
            </button>
          </div>
        </>
      )}

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
        Mode: <span>{store.digitalMode === 'select' ? 'Select' : 'Draw'}</span> | Zoom: <span>{(store.zoom * 100).toFixed(0)}%</span> | Strokes: <span>{store.strokes.length}</span>
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
