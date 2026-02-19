import { useState, useCallback, useEffect, useRef } from 'react';
import { useDrawingStore } from '../store';
import './PropertyPanel.css';

const STORAGE_KEY = 'webstroker-property-panel-position';

interface Position {
  x: number;
  y: number;
}

export const PropertyPanel: React.FC = () => {
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
        return { x: 20, y: 70 };
      }
    }
    return { x: 20, y: 70 };
  });

  const hasSelection = store.selectedStrokeIds.length > 0;
  const firstSelectedStroke = hasSelection
    ? store.strokes.find(s => s.id === store.selectedStrokeIds[0])
    : null;

  const displayColor = hasSelection && firstSelectedStroke
    ? firstSelectedStroke.color
    : store.currentColor;

  const displayThickness = hasSelection && firstSelectedStroke
    ? firstSelectedStroke.thickness
    : store.currentBrushSettings.size;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('property-panel-header')) {
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

  const handleColorChange = (color: string) => {
    if (hasSelection) {
      store.selectedStrokeIds.forEach(id => {
        const stroke = store.strokes.find(s => s.id === id);
        if (stroke) {
          store.updateStroke(id, { ...stroke, color });
        }
      });
    } else {
      store.setColor(color);
    }
  };

  const handleThicknessChange = (thickness: number) => {
    if (hasSelection) {
      store.selectedStrokeIds.forEach(id => {
        const stroke = store.strokes.find(s => s.id === id);
        if (stroke) {
          store.updateStroke(id, { ...stroke, thickness });
        }
      });
    } else {
      store.setBrushSize(thickness);
    }
  };

  return (
    <div
      ref={panelRef}
      className="property-panel"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="property-panel-header">
        {hasSelection ? `${store.selectedStrokeIds.length} Selected` : 'Brush'}
      </div>
      <div className="property-panel-body">
        <div className="property-panel-group">
          <label htmlFor="panel-color">Color:</label>
          <input
            id="panel-color"
            type="color"
            value={displayColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="color-picker"
          />
        </div>
        <div className="property-panel-group">
          <label htmlFor="panel-thickness">Size:</label>
          <input
            id="panel-thickness"
            type="range"
            min="1"
            max="20"
            value={displayThickness}
            onChange={(e) => handleThicknessChange(parseInt(e.target.value))}
            className="slider"
          />
          <span className="thickness-value">{displayThickness}px</span>
        </div>
      </div>
    </div>
  );
};
