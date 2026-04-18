/**
 * App.tsx - 主应用组件 (集成 3D 视图)
 * 
 * 更新内容：
 * - 添加 3D 视图切换
 * - 集成 ThreeViewCanvas
 * - 添加特征树面板
 */

import { useEffect } from 'react';
import './App.css';
import { DrawingCanvas } from './components/DrawingCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import { DrawToolPanel } from './components/DrawToolPanel';
import { Toolbar } from './components/Toolbar';
import { ThreeViewCanvas } from './components/ThreeViewCanvas';
import { FeatureTreePanel } from './components/FeatureTreePanel';
import { ModelingPanel } from './components/ModelingPanel';
import { useDrawingStore } from './store';
import { kernel } from './kernel';

function App() {
    const store = useDrawingStore();

    useEffect(() => {
        // 初始化 OCCT 内核
        kernel.initialize().then(() => {
            console.log('[App] OCCT Kernel initialized');
            (window as any).__kernel__ = kernel;
        });

        // 键盘快捷键
        const handleKeyDown = (e: KeyboardEvent) => {
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
                store.setDigitalMode('select');
            } else if (e.key === 'd' || e.key === 'D') {
                store.setDigitalMode('draw');
            } else if (e.key === 'm' || e.key === 'M') {
                store.setToolCategory('measure');
            } else if (e.key === 'Escape') {
                store.clearSelection();
                if (store.toolCategory === 'measure') {
                    store.clearCurrentMeasurement();
                } else if (store.toolCategory === 'digital' && store.digitalMode === 'draw') {
                    store.incrementClearCounter();
                }
            } else if (e.key === '1') {
                // 切换到 3D 视图
                store.setRenderer('threejs');
            } else if (e.key === '2') {
                // 切换到 2D 视图
                store.setRenderer('canvas2d');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [store]);

    return (
        <div className="app">
            <Toolbar />
            <div className="app-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* 左侧工具面板 */}
                <div className="left-panel" style={{ width: 200, borderRight: '1px solid #ddd' }}>
                    <DrawToolPanel />
                </div>

                {/* 中间画布区域 */}
                <div className="canvas-area" style={{ flex: 1, position: 'relative' }}>
                    {store.renderer === 'threejs' ? (
                        <ThreeViewCanvas
                            onShapeSelect={(shapeId) => console.log('Shape selected:', shapeId)}
                            onShapeHover={(shapeId) => console.log('Shape hovered:', shapeId)}
                        />
                    ) : (
                        <DrawingCanvas />
                    )}
                    
                    {/* 视图切换提示 */}
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        padding: '4px 8px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 12,
                        pointerEvents: 'none'
                    }}>
                        按 1 切换 3D 视图 | 按 2 切换 2D 视图
                    </div>
                </div>

                {/* 右侧属性面板 */}
                <div className="right-panel" style={{ width: 250, borderLeft: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <FeatureTreePanel />
                    </div>
                    <div style={{ height: 200, borderTop: '1px solid #ddd' }}>
                        <PropertyPanel />
                    </div>
                </div>

                {/* 3D 建模面板 (仅在 3D 视图显示) */}
                {store.renderer === 'threejs' && <ModelingPanel />}
            </div>
        </div>
    );
}

export default App;
