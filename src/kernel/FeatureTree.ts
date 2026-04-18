/**
 * FeatureTree - 特征历史树
 * 
 * 管理参数化设计的特征历史，支持：
 * - 特征添加/删除
 * - 特征更新和重建
 * - 父子关系追踪
 * - 撤销/重做支持
 */

import type { Feature, FeatureType, Shape3DData } from '../types3d';
import { generateId } from '../utils';

/**
 * 特征树管理类
 */
export class FeatureTree {
    private features: Map<string, Feature> = new Map();
    private rootFeatures: string[] = [];
    
    /**
     * 添加特征
     */
    addFeature(feature: Feature): void {
        this.features.set(feature.id, feature);
        
        if (!feature.parentId) {
            this.rootFeatures.push(feature.id);
        } else {
            const parent = this.features.get(feature.parentId);
            if (parent) {
                parent.children.push(feature.id);
            }
        }
    }

    /**
     * 获取特征
     */
    getFeature(id: string): Feature | undefined {
        return this.features.get(id);
    }

    /**
     * 删除特征
     */
    deleteFeature(id: string): void {
        const feature = this.features.get(id);
        if (!feature) return;

        // 递归删除所有子特征
        feature.children.forEach(childId => this.deleteFeature(childId));

        // 从父特征的 children 中移除
        if (feature.parentId) {
            const parent = this.features.get(feature.parentId);
            if (parent) {
                parent.children = parent.children.filter(childId => childId !== id);
            }
        } else {
            this.rootFeatures = this.rootFeatures.filter(fid => fid !== id);
        }

        this.features.delete(id);
    }

    /**
     * 更新特征参数
     */
    updateFeature(id: string, parameters: Record<string, any>): void {
        const feature = this.features.get(id);
        if (!feature) return;

        feature.parameters = { ...feature.parameters, ...parameters };
        feature.updatedAt = Date.now();

        // 触发重建
        this.rebuildFrom(id);
    }

    /**
     * 抑制/恢复特征
     */
    suppressFeature(id: string, suppressed: boolean): void {
        const feature = this.features.get(id);
        if (!feature) return;

        feature.suppressed = suppressed;
        
        if (suppressed) {
            this.rebuildFrom(id);
        } else {
            this.rebuildFrom(id);
        }
    }

    /**
     * 从指定特征开始重建
     * 
     * @param featureId 起始特征 ID
     */
    rebuildFrom(featureId: string): void {
        const feature = this.features.get(featureId);
        if (!feature) return;

        console.log('[FeatureTree] Rebuilding from:', featureId);

        // 1. 重新执行当前特征
        this.executeFeature(feature);

        // 2. 递归重建所有子特征
        feature.children.forEach(childId => {
            const child = this.features.get(childId);
            if (child && !child.suppressed) {
                this.rebuildFrom(childId);
            }
        });

        // 3. 触发更新事件
        this.onFeatureTreeChanged();
    }

    /**
     * 执行特征
     * 
     * @internal
     */
    private executeFeature(feature: Feature): void {
        // TODO: 根据特征类型执行不同的几何操作
        // 这需要访问 ShapeFactory 和 Store
        
        console.log('[FeatureTree] Executing feature:', {
            id: feature.id,
            type: feature.type,
            parameters: feature.parameters
        });

        // 示例：拉伸特征
        if (feature.type === 'extrude') {
            // const shape = ShapeFactory.extrude(feature.parameters.sketch, feature.parameters.distance);
            // feature.resultShapeId = shape.id;
        }

        // 示例：布尔特征
        if (feature.type === 'boolean') {
            // const shape = ShapeFactory.fuse(shapeA, shapeB);
            // feature.resultShapeId = shape.id;
        }
    }

    /**
     * 获取所有特征
     */
    getAllFeatures(): Feature[] {
        return Array.from(this.features.values());
    }

    /**
     * 获取根特征
     */
    getRootFeatures(): Feature[] {
        return this.rootFeatures.map(id => this.features.get(id)!).filter(Boolean);
    }

    /**
     * 获取特征的子特征
     */
    getChildren(featureId: string): Feature[] {
        const feature = this.features.get(featureId);
        if (!feature) return [];
        
        return feature.children
            .map(id => this.features.get(id))
            .filter(Boolean) as Feature[];
    }

    /**
     * 获取特征树 (层级结构)
     */
    getTreeStructure(): any[] {
        const buildTree = (featureId: string): any => {
            const feature = this.features.get(featureId);
            if (!feature) return null;

            return {
                ...feature,
                children: feature.children.map(childId => buildTree(childId))
            };
        };

        return this.rootFeatures.map(id => buildTree(id)).filter(Boolean);
    }

    /**
     * 序列化特征树
     */
    serialize(): any {
        return {
            features: Array.from(this.features.entries()),
            rootFeatures: this.rootFeatures
        };
    }

    /**
     * 反序列化特征树
     */
    deserialize(data: any): void {
        this.features.clear();
        this.rootFeatures = [];

        data.features.forEach(([id, feature]: [string, Feature]) => {
            this.features.set(id, feature);
        });

        this.rootFeatures = data.rootFeatures || [];
    }

    /**
     * 清空特征树
     */
    clear(): void {
        this.features.clear();
        this.rootFeatures = [];
    }

    /**
     * 特征树变更回调
     * 
     * @virtual
     */
    protected onFeatureTreeChanged(): void {
        // 子类可重写
        window.dispatchEvent(new CustomEvent('feature-tree-changed', {
            detail: { tree: this }
        }));
    }
}

/**
 * 创建特征辅助函数
 */
export function createFeature(
    type: FeatureType,
    name: string,
    parameters: Record<string, any>,
    parentId?: string
): Feature {
    return {
        id: generateId(),
        type,
        name,
        parentId: parentId ?? null,
        children: [],
        parameters,
        resultShapeId: null,
        suppressed: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

/**
 * 创建拉伸特征
 */
export function createExtrudeFeature(
    sketchId: string,
    distance: number,
    parentId?: string
): Feature {
    return createFeature('extrude', 'Extrude', {
        sketchId,
        distance,
        direction: 'one-way',
        taperAngle: 0
    }, parentId);
}

/**
 * 创建旋转特征
 */
export function createRevolveFeature(
    sketchId: string,
    axisStart: { x: number; y: number; z: number },
    axisEnd: { x: number; y: number; z: number },
    angle: number = 360,
    parentId?: string
): Feature {
    return createFeature('revolve', 'Revolve', {
        sketchId,
        axisStart,
        axisEnd,
        angle
    }, parentId);
}

/**
 * 创建布尔特征
 */
export function createBooleanFeature(
    operation: 'union' | 'subtract' | 'intersect',
    targetShapeId: string,
    toolShapeIds: string[],
    parentId?: string
): Feature {
    return createFeature('boolean', `Boolean ${operation}`, {
        operation,
        targetShapeId,
        toolShapeIds
    }, parentId);
}

// 导出单例
export const featureTreeInstance = new FeatureTree();
