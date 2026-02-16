import { useState, useCallback, useEffect, useRef } from 'react';
import { useDrawingStore } from '../store';
import type { BrushType } from '../brush/presets';
import './DrawToolPanel.css';

const STORAGE_KEY = 'webstroker-drawtool-panel-position';

interface Position {
  x: number;
  y: number;
}

const BRUSH_ICONS: Record<BrushType, string> = {
  pencil: '✏️',
  pen: '🖊️',
  brush: '🖌️',
  ballpen: '🖋️',
};

const BRUSH_LABELS: Record<BrushType, string> = {
  pencil: 'Pencil',
  pen: 'Pen',
  brush: 'Brush',
  ballpen: 'Ball Pen',
};

const BRUSH_TYPES: BrushType[] = ['pencil', 'pen', 'brush', 'ballpen'];

export const DrawToolPanel: React.FC = () => {
  const store = useDrawingStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { x: 20, y: 140 };
      }
    }
    return { x: 20, y: 140 };
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('drawtool-panel-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [isDragging, position]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={panelRef}
      className="drawtool-panel"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="drawtool-panel-header">
        Draw Tools
      </div>
      <div className="drawtool-panel-body">
        <div className="drawtool-panel-section">
          <div className="drawtool-brush-selector">
            {BRUSH_TYPES.map((brushType) => (
              <button
                key={brushType}
                className={`drawtool-brush-btn ${store.currentBrushType === brushType ? 'active' : ''}`}
                onClick={() => store.setBrushType(brushType)}
                title={BRUSH_LABELS[brushType]}
              >
                <span className="drawtool-brush-icon">{BRUSH_ICONS[brushType]}</span>
                <span className="drawtool-brush-label">{BRUSH_LABELS[brushType]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="drawtool-panel-section">
          <label className="drawtool-slider-label">
            Size: {store.currentBrushSettings.size}
            <input
              type="range"
              min="1"
              max="30"
              value={store.currentBrushSettings.size}
              onChange={(e) => store.setBrushSize(parseInt(e.target.value))}
              className="drawtool-slider"
            />
          </label>
        </div>

        <div className="drawtool-panel-section">
          <label className="drawtool-slider-label">
            Opacity: {(store.currentBrushSettings.opacity * 100).toFixed(0)}%
            <input
              type="range"
              min="10"
              max="100"
              value={store.currentBrushSettings.opacity * 100}
              onChange={(e) => store.setBrushOpacity(parseInt(e.target.value) / 100)}
              className="drawtool-slider"
            />
          </label>
        </div>

        <div className="drawtool-panel-section">
          <label className="drawtool-slider-label">
            Hardness: {(store.currentBrushSettings.hardness * 100).toFixed(0)}%
            <input
              type="range"
              min="0"
              max="100"
              value={store.currentBrushSettings.hardness * 100}
              onChange={(e) => store.setBrushHardness(parseInt(e.target.value) / 100)}
              className="drawtool-slider"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
