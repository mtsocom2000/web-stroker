import { useState, useCallback, useEffect, useRef } from 'react';
import { useDrawingStore } from '../store';
import type { ArtisticTool, DigitalTool, LengthUnit } from '../types';
import './DrawToolPanel.css';

const UNIT_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'inch', label: 'inch' },
  { value: 'px', label: 'px' },
];

const STORAGE_KEY = 'webstroker-drawtool-panel-position';

interface Position {
  x: number;
  y: number;
}

const ARTISTIC_ICONS: Record<ArtisticTool, string> = {
  pencil: '✏️',
  pen: '🖊️',
  brush: '🖌️',
  ballpen: '🖋️',
  eraser: '🧹',
};

const ARTISTIC_LABELS: Record<ArtisticTool, string> = {
  pencil: 'Pencil',
  pen: 'Pen',
  brush: 'Brush',
  ballpen: 'Ball Pen',
  eraser: 'Eraser',
};

const ARTISTIC_TOOLS: ArtisticTool[] = ['pencil', 'pen', 'brush', 'ballpen', 'eraser'];

const DIGITAL_ICONS: Record<DigitalTool, string> = {
  line: '📏',
  circle: '⭕',
  curve: '〰️',
};

const DIGITAL_LABELS: Record<DigitalTool, string> = {
  line: 'Line',
  circle: 'Circle',
  curve: 'Curve',
};

const DIGITAL_TOOLS: DigitalTool[] = ['line', 'circle', 'curve'];

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

  const isArtisticActive = store.toolCategory === 'artistic';
  const isDigitalActive = store.toolCategory === 'digital';

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
          <div className="drawtool-category-tabs">
            <button
              className={`drawtool-tab ${isArtisticActive ? 'active' : ''}`}
              onClick={() => store.setToolCategory('artistic')}
            >
              Artistic
            </button>
            <button
              className={`drawtool-tab ${isDigitalActive ? 'active' : ''}`}
              onClick={() => store.setToolCategory('digital')}
            >
              Digital
            </button>
          </div>
        </div>

        {isArtisticActive && (
          <>
            <div className="drawtool-panel-section">
              <div className="drawtool-tool-selector">
                {ARTISTIC_TOOLS.map((tool) => (
                  <button
                    key={tool}
                    className={`drawtool-tool-btn ${store.artisticTool === tool ? 'active' : ''}`}
                    onClick={() => store.setArtisticTool(tool)}
                    title={ARTISTIC_LABELS[tool]}
                  >
                    <span className="drawtool-tool-icon">{ARTISTIC_ICONS[tool]}</span>
                    <span className="drawtool-tool-label">{ARTISTIC_LABELS[tool]}</span>
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
          </>
        )}

        {isDigitalActive && (
          <>
            <div className="drawtool-panel-section">
              <div className="drawtool-tool-selector">
                {DIGITAL_TOOLS.map((tool) => (
                  <button
                    key={tool}
                    className={`drawtool-tool-btn ${store.digitalTool === tool ? 'active' : ''}`}
                    onClick={() => store.setDigitalTool(tool)}
                    title={DIGITAL_LABELS[tool]}
                  >
                    <span className="drawtool-tool-icon">{DIGITAL_ICONS[tool]}</span>
                    <span className="drawtool-tool-label">{DIGITAL_LABELS[tool]}</span>
                  </button>
                ))}
              </div>
            </div>

            {store.digitalTool === 'circle' && (
              <div className="drawtool-panel-section">
                <div className="drawtool-mode-selector">
                  <button
                    className={`drawtool-mode-btn ${store.circleCreationMode === 'centerRadius' ? 'active' : ''}`}
                    onClick={() => store.setCircleCreationMode('centerRadius')}
                  >
                    Center+Radius
                  </button>
                  <button
                    className={`drawtool-mode-btn ${store.circleCreationMode === 'threePoint' ? 'active' : ''}`}
                    onClick={() => store.setCircleCreationMode('threePoint')}
                  >
                    3-Point
                  </button>
                </div>
              </div>
            )}

            <div className="drawtool-panel-section">
              <div className="drawtool-color-label">
                <span>Color:</span>
                <input
                  type="color"
                  value={store.currentColor}
                  onChange={(e) => store.setColor(e.target.value)}
                  className="drawtool-color-picker"
                />
              </div>
            </div>

            <div className="drawtool-panel-section">
              <div className="drawtool-color-label">
                <span>Unit:</span>
                <select
                  value={store.unit}
                  onChange={(e) => store.setUnit(e.target.value as LengthUnit)}
                  className="drawtool-unit-select"
                >
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="drawtool-panel-section">
              <div className="drawtool-mode-selector">
                <button
                  className={`drawtool-mode-btn ${store.digitalMode === 'draw' ? 'active' : ''}`}
                  onClick={() => store.setDigitalMode('draw')}
                >
                  Draw
                </button>
                <button
                  className={`drawtool-mode-btn ${store.digitalMode === 'select' ? 'active' : ''}`}
                  onClick={() => store.setDigitalMode('select')}
                >
                  Select
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
