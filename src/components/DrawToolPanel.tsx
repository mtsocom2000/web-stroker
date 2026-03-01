import { useState, useCallback, useEffect, useRef } from 'react';
import { useDrawingStore } from '../store';
import type { ArtisticTool, DigitalTool, LengthUnit, MeasureTool } from '../types';
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
  arc: '◖',
  curve: '〰️',
};

const DIGITAL_LABELS: Record<DigitalTool, string> = {
  line: 'Line',
  circle: 'Circle',
  arc: 'Arc',
  curve: 'Curve',
};

const DIGITAL_TOOLS: DigitalTool[] = ['line', 'circle', 'arc', 'curve'];

const MEASURE_ICONS: Record<MeasureTool, string> = {
  distance: '📏',
  angle: '📐',
  radius: '⭕',
};

const MEASURE_LABELS: Record<MeasureTool, string> = {
  distance: 'Distance',
  angle: 'Angle',
  radius: 'Radius',
};

const MEASURE_TOOLS: MeasureTool[] = ['distance', 'angle', 'radius'];

export const DrawToolPanel: React.FC = () => {
  const store = useDrawingStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'artistic' | 'digital'>('digital');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    select: true,
    draw: true,
    measure: true,
  });
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

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

  const handleDrawTool = (tool: DigitalTool) => {
    const isFromSelect = store.toolCategory === 'digital' && store.digitalMode === 'select';
    const isFromMeasure = store.toolCategory === 'measure';
    const isFromDifferentDrawTool = store.toolCategory === 'digital' && store.digitalMode === 'draw' && store.digitalTool !== tool;
    
    if (isFromSelect || isFromMeasure || isFromDifferentDrawTool) {
      store.clearMeasure();
      store.incrementClearCounter();
    }
    store.setDigitalTool(tool);
    store.setDigitalMode('draw');
    store.setToolCategory('digital');
  };

  const handleMeasureTool = (tool: MeasureTool) => {
    const isFromDraw = store.toolCategory === 'digital' && store.digitalMode === 'draw';
    if (isFromDraw) {
      store.incrementClearCounter();
    }
    store.clearMeasure();
    store.setToolCategory('measure');
    store.setMeasureTool(tool);
    
    if (tool === 'distance') {
      store.setSelectMode('point');
    } else if (tool === 'radius') {
      store.setSelectMode('arc');
    } else if (tool === 'angle') {
      store.setSelectMode('line');
    }
  };

  const handleTabChange = (tab: 'artistic' | 'digital') => {
    setActiveTab(tab);
    if (tab === 'artistic') {
      store.setToolCategory('artistic');
    } else {
      store.setToolCategory('digital');
    }
  };

  const isToolActive = (tool: DigitalTool | MeasureTool): boolean => {
    if (store.toolCategory === 'measure') {
      return store.measureTool === tool;
    }
    if (store.toolCategory === 'digital' && store.digitalMode === 'draw') {
      return store.digitalTool === tool;
    }
    return false;
  };

  const isMeasureActive = store.toolCategory === 'measure';

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
        Tools
      </div>
      <div className="drawtool-panel-body">
        {/* Tab Selector */}
        <div className="drawtool-panel-section">
          <div className="drawtool-category-tabs">
            <button
              className={`drawtool-tab ${activeTab === 'artistic' ? 'active' : ''}`}
              onClick={() => handleTabChange('artistic')}
            >
              Artistic
            </button>
            <button
              className={`drawtool-tab ${activeTab === 'digital' ? 'active' : ''}`}
              onClick={() => handleTabChange('digital')}
            >
              Digital
            </button>
          </div>
        </div>

        {activeTab === 'artistic' && (
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
        )}

        {activeTab === 'digital' && (
          <>
            {/* Select Accordion */}
            <div className="drawtool-accordion">
              <button
                className={`drawtool-accordion-header ${expandedSections.select ? 'expanded' : ''}`}
                onClick={() => {
                  toggleSection('select');
                  store.setDigitalMode('select');
                  store.setToolCategory('digital');
                }}
              >
                <span>Select</span>
                <span className="drawtool-accordion-arrow">{expandedSections.select ? '▼' : '▶'}</span>
              </button>
              {expandedSections.select && (
                <div className="drawtool-accordion-content">
                  <div className="drawtool-panel-section">
                    <div className="drawtool-mode-selector">
                      <button
                        className={`drawtool-mode-btn ${store.selectMode === 'point' ? 'active' : ''}`}
                        onClick={() => store.setSelectMode('point')}
                      >
                        Point
                      </button>
                      <button
                        className={`drawtool-mode-btn ${store.selectMode === 'line' ? 'active' : ''}`}
                        onClick={() => store.setSelectMode('line')}
                      >
                        Line
                      </button>
                      <button
                        className={`drawtool-mode-btn ${store.selectMode === 'arc' ? 'active' : ''}`}
                        onClick={() => store.setSelectMode('arc')}
                      >
                        Arc/Circle
                      </button>
                    </div>
                  </div>

                  <div className="drawtool-panel-section">
                    <label className="drawtool-checkbox-label">
                      <input
                        type="checkbox"
                        checked={store.snapEnabled}
                        onChange={(e) => store.setSnapEnabled(e.target.checked)}
                      />
                      Snap
                    </label>
                  </div>

                  {store.snapEnabled && (
                    <div className="drawtool-panel-section">
                      <label className="drawtool-slider-label">
                        Snap: {store.snapThreshold}px
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={store.snapThreshold}
                          onChange={(e) => store.setSnapThreshold(parseInt(e.target.value))}
                          className="drawtool-slider"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Draw Accordion */}
            <div className="drawtool-accordion">
              <button
                className={`drawtool-accordion-header ${expandedSections.draw ? 'expanded' : ''}`}
                onClick={() => {
                  toggleSection('draw');
                  store.setDigitalMode('draw');
                  store.setToolCategory('digital');
                }}
              >
                <span>Draw</span>
                <span className="drawtool-accordion-arrow">{expandedSections.draw ? '▼' : '▶'}</span>
              </button>
              {expandedSections.draw && (
                <div className="drawtool-accordion-content">
                  <div className="drawtool-tool-selector">
                    {DIGITAL_TOOLS.map((tool) => (
                      <button
                        key={tool}
                        className={`drawtool-tool-btn ${isToolActive(tool) ? 'active' : ''}`}
                        onClick={() => handleDrawTool(tool)}
                        title={DIGITAL_LABELS[tool]}
                      >
                        <span className="drawtool-tool-icon">{DIGITAL_ICONS[tool]}</span>
                        <span className="drawtool-tool-label">{DIGITAL_LABELS[tool]}</span>
                      </button>
                    ))}
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
                </div>
              )}
            </div>

            {/* Measure Accordion */}
            <div className="drawtool-accordion">
              <button
                className={`drawtool-accordion-header ${expandedSections.measure ? 'expanded' : ''}`}
                onClick={() => toggleSection('measure')}
              >
                <span>Measure</span>
                <span className="drawtool-accordion-arrow">{expandedSections.measure ? '▼' : '▶'}</span>
              </button>
              {expandedSections.measure && (
                <div className="drawtool-accordion-content">
                  <div className="drawtool-tool-selector">
                    {MEASURE_TOOLS.map((tool) => (
                      <button
                        key={tool}
                        className={`drawtool-tool-btn ${isToolActive(tool) ? 'active' : ''}`}
                        onClick={() => handleMeasureTool(tool)}
                        title={MEASURE_LABELS[tool]}
                      >
                        <span className="drawtool-tool-icon">{MEASURE_ICONS[tool]}</span>
                        <span className="drawtool-tool-label">{MEASURE_LABELS[tool]}</span>
                      </button>
                    ))}
                  </div>

                  {isMeasureActive && (
                    <>
                      <div className="drawtool-panel-section">
                        <div className="measure-value-display">
                          <span className="measure-value-label">Last:</span>
                          <span className="measure-value">{store.lastMeasureValue}</span>
                        </div>
                      </div>

                      {store.measureFirstLine !== null && store.measureTool === 'angle' && (
                        <div className="drawtool-panel-section">
                          <div className="measure-info">
                            <span>First line selected</span>
                          </div>
                        </div>
                      )}

                      <div className="drawtool-panel-section">
                        <button
                          className="drawtool-clear-btn"
                          onClick={() => store.clearMeasure()}
                        >
                          Clear
                        </button>
                      </div>

                      <div className="drawtool-panel-section measure-hint">
                        <span>Click to measure, right-click to clear</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Unit Selector - always visible in digital tab */}
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
          </>
        )}
      </div>
    </div>
  );
};
