/**
 * ModelingPanel - 3D 建模操作面板
 * 
 * 提供从 2D 草图到 3D 实体的转换功能：
 * - 拉伸 (Extrude)
 * - 旋转 (Revolve)
 * - 扫掠 (Sweep)
 * - 放样 (Loft)
 */

import { useState, useCallback, useRef } from 'react';
import { useDrawingStore } from '../store';
import { CommandStore } from '../commands/CommandStore';
import './ModelingPanel.css';

const STORAGE_KEY = 'webstroker-modeling-panel-position';

interface Position {
  x: number;
  y: number;
}

export const ModelingPanel: React.FC = () => {
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
        return { x: 600, y: 140 };
      }
    }
    return { x: 600, y: 140 };
  });

  // 拉伸参数
  const [extrudeDistance, setExtrudeDistance] = useState(10);
  const [extrudeTaper, setExtrudeTaper] = useState(0);
  
  // 旋转参数
  const [revolveAngle, setRevolveAngle] = useState(360);
  const [revolveAxis, setRevolveAxis] = useState<'X' | 'Y' | 'Z'>('Z');

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('modeling-panel-header')) {
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

  // 获取选中的草图
  const getSelectedSketch = useCallback(() => {
    const selectedSketchIds = store.selectedDigitalStrokeIds;
    if (selectedSketchIds.length === 0) {
      return null;
    }

    const sketch = store.strokes.find(s => s.id === selectedSketchIds[0]);
    if (!sketch) {
      return null;
    }

    // 转换为 Sketch3D 格式
    return {
      id: sketch.id,
      name: 'Sketch',
      workplaneId: 'XY',
      segments: sketch.digitalSegments?.map(seg => ({
        type: seg.type,
        startPoint: seg.points[0],
        endPoint: seg.points[seg.points.length - 1],
        center: seg.points[0],
        radius: 10,
        startAngle: 0,
        endAngle: Math.PI * 2,
        controlPoints: seg.points
      })) || [],
      constraints: [],
      isClosed: sketch.isClosed
    };
  }, [store.strokes, store.selectedDigitalStrokeIds]);

  // 拉伸操作
  const handleExtrude = useCallback(async () => {
    const sketch = getSelectedSketch();
    if (!sketch) {
      alert('请先选择一个封闭草图');
      return;
    }

    try {
      const cmd = CommandStore.create('sketch.extrude', {
        sketchId: sketch.id,
        distance: extrudeDistance,
        taperAngle: extrudeTaper
      });
      await cmd.execute();
      console.log('[ModelingPanel] Extrude completed');
    } catch (error) {
      console.error('[ModelingPanel] Extrude failed:', error);
      alert('拉伸失败：' + (error as Error).message);
    }
  }, [getSelectedSketch, extrudeDistance, extrudeTaper]);

  // 旋转操作
  const handleRevolve = useCallback(async () => {
    const sketch = getSelectedSketch();
    if (!sketch) {
      alert('请先选择一个封闭草图');
      return;
    }

    try {
      const axisStart = { x: 0, y: 0, z: 0 };
      const axisEnd = { x: 0, y: 0, z: 1 }; // Z 轴

      const cmd = CommandStore.create('sketch.revolve', {
        sketchId: sketch.id,
        axisStart,
        axisEnd,
        angle: revolveAngle
      });
      await cmd.execute();
      console.log('[ModelingPanel] Revolve completed');
    } catch (error) {
      console.error('[ModelingPanel] Revolve failed:', error);
      alert('旋转失败：' + (error as Error).message);
    }
  }, [getSelectedSketch, revolveAngle]);

  // 扫掠操作
  const handleSweep = useCallback(async () => {
    alert('扫掠功能开发中...');
    // TODO: 实现扫掠
  }, []);

  // 放样操作
  const handleLoft = useCallback(async () => {
    alert('放样功能开发中...');
    // TODO: 实现放样
  }, []);

  return (
    <div
      ref={panelRef}
      className="modeling-panel"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="modeling-panel-header">
        3D Modeling
      </div>
      
      <div className="modeling-panel-body">
        {/* 草图选择状态 */}
        <div className="modeling-panel-section">
          <div className="modeling-status">
            {getSelectedSketch() ? (
              <span className="status-ok">✅ 草图已选择</span>
            ) : (
              <span className="status-warn">⚠️ 请先选择草图</span>
            )}
          </div>
        </div>

        {/* 拉伸操作 */}
        <div className="modeling-panel-section">
          <div className="modeling-section-title">
            Extrude (拉伸)
          </div>
          
          <div className="modeling-input-group">
            <label className="modeling-label">
              Distance:
              <input
                type="number"
                value={extrudeDistance}
                onChange={(e) => setExtrudeDistance(Number(e.target.value))}
                className="modeling-input"
                min="0"
                step="1"
              />
            </label>
          </div>

          <div className="modeling-input-group">
            <label className="modeling-label">
              Taper Angle:
              <input
                type="number"
                value={extrudeTaper}
                onChange={(e) => setExtrudeTaper(Number(e.target.value))}
                className="modeling-input"
                min="0"
                max="45"
                step="1"
              />
            </label>
          </div>

          <button
            className="modeling-btn"
            onClick={handleExtrude}
            disabled={!getSelectedSketch()}
          >
            拉伸
          </button>
        </div>

        {/* 旋转操作 */}
        <div className="modeling-panel-section">
          <div className="modeling-section-title">
            Revolve (旋转)
          </div>
          
          <div className="modeling-input-group">
            <label className="modeling-label">
              Angle:
              <input
                type="number"
                value={revolveAngle}
                onChange={(e) => setRevolveAngle(Number(e.target.value))}
                className="modeling-input"
                min="0"
                max="360"
                step="15"
              />
            </label>
          </div>

          <div className="modeling-input-group">
            <label className="modeling-label">
              Axis:
              <select
                value={revolveAxis}
                onChange={(e) => setRevolveAxis(e.target.value as 'X' | 'Y' | 'Z')}
                className="modeling-select"
              >
                <option value="X">X 轴</option>
                <option value="Y">Y 轴</option>
                <option value="Z">Z 轴</option>
              </select>
            </label>
          </div>

          <button
            className="modeling-btn"
            onClick={handleRevolve}
            disabled={!getSelectedSketch()}
          >
            旋转
          </button>
        </div>

        {/* 扫掠和放样 (开发中) */}
        <div className="modeling-panel-section">
          <div className="modeling-section-title">
            Advanced (高级)
          </div>
          
          <div className="modeling-btn-group">
            <button
              className="modeling-btn"
              onClick={handleSweep}
              disabled
              title="开发中"
            >
              Sweep (扫掠) 🚧
            </button>
            
            <button
              className="modeling-btn"
              onClick={handleLoft}
              disabled
              title="开发中"
            >
              Loft (放样) 🚧
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
