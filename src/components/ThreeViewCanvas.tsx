/**
 * ThreeViewCanvas - Three.js 3D 视图组件
 * 
 * React 组件，集成 ThreeRenderer
 */

import React, { useEffect, useRef, useState } from 'react';
import { ThreeRenderer } from '../renderers/ThreeRenderer';
import type { Shape3DData, Workplane } from '../types3d';

interface ThreeViewCanvasProps {
    className?: string;
    onShapeSelect?: (shapeId: string) => void;
    onShapeHover?: (shapeId: string | null) => void;
}

export const ThreeViewCanvas: React.FC<ThreeViewCanvasProps> = ({
    className = '',
    onShapeSelect,
    onShapeHover
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<ThreeRenderer | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // 初始化渲染器
    useEffect(() => {
        if (!containerRef.current) return;

        // 创建渲染器
        const renderer = new ThreeRenderer({
            container: containerRef.current,
            backgroundColor: 0x1a1a1a,
            antialias: true
        });

        rendererRef.current = renderer;
        setIsInitialized(true);

        // 监听对象选择事件
        const handleSelect = (event: Event) => {
            const customEvent = event as CustomEvent<{ objectId: string }>;
            onShapeSelect?.(customEvent.detail.objectId);
        };

        const handleHover = (event: Event) => {
            const customEvent = event as CustomEvent<{ objectId: string | null }>;
            onShapeHover?.(customEvent.detail.objectId);
        };

        window.addEventListener('object-selected', handleSelect);
        window.addEventListener('object-hovered', handleHover);

        // 监听形状创建事件
        const handleShapeCreated = (event: Event) => {
            const customEvent = event as CustomEvent<{ detail: Shape3DData }>;
            const shapeData = customEvent.detail;
            
            if (rendererRef.current && shapeData) {
                rendererRef.current.addShape(shapeData);
                rendererRef.current.fitToContent();
            }
        };

        window.addEventListener('shape-created', handleShapeCreated);

        // 监听形状删除事件
        const handleShapeRemoved = (event: Event) => {
            const customEvent = event as CustomEvent<{ detail: { id: string } }>;
            const shapeId = customEvent.detail.id;
            
            if (rendererRef.current) {
                rendererRef.current.removeShape(shapeId);
            }
        };

        window.addEventListener('shape-removed', handleShapeRemoved);

        // 清理
        return () => {
            window.removeEventListener('object-selected', handleSelect);
            window.removeEventListener('object-hovered', handleHover);
            window.removeEventListener('shape-created', handleShapeCreated);
            window.removeEventListener('shape-removed', handleShapeRemoved);
            
            renderer.dispose();
            rendererRef.current = null;
            setIsInitialized(false);
        };
    }, []);

    // 暴露渲染器方法给父组件
    useEffect(() => {
        if (rendererRef.current) {
            (window as any).__threeRenderer__ = rendererRef.current;
        }
        return () => {
            delete (window as any).__threeRenderer__;
        };
    }, [isInitialized]);

    return (
        <div
            ref={containerRef}
            className={`three-view-canvas ${className}`}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {!isInitialized && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#666',
                    fontSize: '14px'
                }}>
                    初始化 3D 视图...
                </div>
            )}
        </div>
    );
};

export default ThreeViewCanvas;
