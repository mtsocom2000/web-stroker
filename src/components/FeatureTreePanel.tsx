/**
 * FeatureTreePanel - 特征树面板组件
 * 
 * 显示和管理特征历史树
 */

import React, { useState, useEffect } from 'react';
import type { Feature } from '../types3d';
import { featureTreeInstance } from '../kernel/FeatureTree';

interface FeatureTreePanelProps {
    className?: string;
}

export const FeatureTreePanel: React.FC<FeatureTreePanelProps> = ({
    className = ''
}) => {
    const [features, setFeatures] = useState<Feature[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // 监听特征树变更
    useEffect(() => {
        const handleTreeChanged = () => {
            setFeatures(featureTreeInstance.getAllFeatures());
        };

        window.addEventListener('feature-tree-changed', handleTreeChanged);
        
        // 初始加载
        handleTreeChanged();

        return () => {
            window.removeEventListener('feature-tree-changed', handleTreeChanged);
        };
    }, []);

    // 切换节点展开/折叠
    const toggleNode = (featureId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(featureId)) {
            newExpanded.delete(featureId);
        } else {
            newExpanded.add(featureId);
        }
        setExpandedNodes(newExpanded);
    };

    // 抑制/恢复特征
    const toggleSuppress = (feature: Feature) => {
        featureTreeInstance.suppressFeature(feature.id, !feature.suppressed);
    };

    // 删除特征
    const deleteFeature = (feature: Feature) => {
        if (confirm(`确定要删除特征 "${feature.name}" 及其所有子特征吗？`)) {
            featureTreeInstance.deleteFeature(feature.id);
        }
    };

    // 渲染特征节点
    const renderFeatureNode = (feature: Feature, depth: number = 0): React.ReactNode => {
        const isExpanded = expandedNodes.has(feature.id);
        const hasChildren = feature.children.length > 0;

        return (
            <div key={feature.id} style={{ marginLeft: depth * 16 }}>
                <div
                    className={`feature-node ${feature.suppressed ? 'suppressed' : ''}`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        borderRadius: 4,
                        opacity: feature.suppressed ? 0.5 : 1
                    }}
                    onClick={() => hasChildren && toggleNode(feature.id)}
                >
                    {/* 展开/折叠图标 */}
                    {hasChildren ? (
                        <span style={{ marginRight: 4, fontSize: 10 }}>
                            {isExpanded ? '▼' : '▶'}
                        </span>
                    ) : (
                        <span style={{ marginRight: 4, width: 10 }} />
                    )}

                    {/* 特征图标 */}
                    <span style={{ marginRight: 8 }}>
                        {getFeatureIcon(feature.type)}
                    </span>

                    {/* 特征名称 */}
                    <span style={{ flex: 1, fontSize: 13 }}>
                        {feature.name}
                    </span>

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleSuppress(feature);
                            }}
                            style={{
                                padding: '2px 6px',
                                fontSize: 11,
                                cursor: 'pointer'
                            }}
                        >
                            {feature.suppressed ? '恢复' : '抑制'}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteFeature(feature);
                            }}
                            style={{
                                padding: '2px 6px',
                                fontSize: 11,
                                cursor: 'pointer',
                                color: 'red'
                            }}
                        >
                            删除
                        </button>
                    </div>
                </div>

                {/* 子特征 */}
                {isExpanded && hasChildren && (
                    <div>
                        {feature.children.map(childId => {
                            const child = featureTreeInstance.getFeature(childId);
                            if (!child) return null;
                            return renderFeatureNode(child, depth + 1);
                        })}
                    </div>
                )}
            </div>
        );
    };

    // 获取特征图标
    const getFeatureIcon = (type: string): string => {
        const icons: Record<string, string> = {
            sketch: '📐',
            extrude: '📦',
            revolve: '🔄',
            boolean: '⚡',
            fillet: '⌒',
            chamfer: '∠',
            shell: '📋',
            hole: '⭕',
            pattern: '∷'
        };
        return icons[type] || '🔷';
    };

    // 获取根特征
    const rootFeatures = featureTreeInstance.getRootFeatures();

    return (
        <div
            className={`feature-tree-panel ${className}`}
            style={{
                padding: 8,
                overflow: 'auto',
                height: '100%'
            }}
        >
            <div style={{
                fontSize: 12,
                fontWeight: 'bold',
                marginBottom: 8,
                padding: '4px 8px',
                backgroundColor: '#f0f0f0',
                borderRadius: 4
            }}>
                特征树
            </div>

            {rootFeatures.length === 0 ? (
                <div style={{
                    color: '#999',
                    fontSize: 12,
                    padding: 16,
                    textAlign: 'center'
                }}>
                    暂无特征
                </div>
            ) : (
                <div>
                    {rootFeatures.map(feature => renderFeatureNode(feature))}
                </div>
            )}
        </div>
    );
};

export default FeatureTreePanel;
