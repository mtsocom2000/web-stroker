import type { Point } from '../../types';

/**
 * Render Command Types
 * 
 * Unified command format for all drawing operations.
 * DrawingCommander generates commands, Renderer executes them.
 */

export type CommandType = 'stroke' | 'preview' | 'highlight' | 'indicator' | 'label' | 'closedArea';

export type GeometryType = 'line' | 'circle' | 'arc' | 'bezier' | 'point' | 'polygon';

export type LineStyle = 'solid' | 'dashed';

/**
 * Render style properties
 */
export interface RenderStyle {
  /** Stroke/fill color */
  color: string;
  /** Line width in pixels */
  lineWidth: number;
  /** Solid or dashed line */
  lineStyle: LineStyle;
  /** Opacity 0-1 */
  opacity: number;
  /** For indicators: size */
  size?: number;
}

/**
 * Base command interface
 */
export interface BaseRenderCommand {
  /** Command type */
  type: CommandType;
  /** Z-index for ordering */
  zIndex: number;
  /** Render style */
  style: RenderStyle;
  /** Associated stroke ID */
  strokeId?: string;
  /** Segment index within stroke */
  segmentIndex?: number;
}

/**
 * Line geometry
 */
export interface LineGeometry {
  type: 'line';
  points: Point[];
}

/**
 * Circle geometry
 */
export interface CircleGeometry {
  type: 'circle';
  center: Point;
  radius: number;
}

/**
 * Arc geometry
 */
export interface ArcGeometry {
  type: 'arc';
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/**
 * Bezier curve geometry
 */
export interface BezierGeometry {
  type: 'bezier';
  points: Point[]; // 4 points for cubic bezier
}

/**
 * Point geometry (for indicators)
 */
export interface PointGeometry {
  type: 'point';
  point: Point;
}

/**
 * Polygon geometry (for closed areas)
 */
export interface PolygonGeometry {
  type: 'polygon';
  points: Point[];
}

/**
 * Union of all geometry types
 */
export type Geometry =
  | LineGeometry
  | CircleGeometry
  | ArcGeometry
  | BezierGeometry
  | PointGeometry
  | PolygonGeometry;

/**
 * Complete render command
 */
export interface RenderCommand extends BaseRenderCommand {
  geometry: Geometry;
}

/**
 * Command for drawing strokes
 */
export interface StrokeCommand extends RenderCommand {
  type: 'stroke';
}

/**
 * Command for drawing previews (during drawing)
 */
export interface PreviewCommand extends RenderCommand {
  type: 'preview';
}

/**
 * Command for drawing highlights (hover/select)
 */
export interface HighlightCommand extends RenderCommand {
  type: 'highlight';
  /** Selection state */
  isSelected?: boolean;
  /** Hover state */
  isHovered?: boolean;
}

/**
 * Command for drawing endpoint/control point indicators
 */
export interface IndicatorCommand extends RenderCommand {
  type: 'indicator';
  geometry: PointGeometry;
  /** Indicator type */
  indicatorType: 'endpoint' | 'control' | 'cross';
}

/**
 * Command for drawing text labels
 */
export interface LabelCommand extends RenderCommand {
  type: 'label';
  text: string;
  position: Point;
  fontSize?: number;
}

/**
 * Command for drawing closed areas
 */
export interface ClosedAreaCommand extends RenderCommand {
  type: 'closedArea';
  geometry: PolygonGeometry;
  /** Fill pattern */
  pattern?: 'hatch' | 'grid' | 'dots' | 'solid';
  /** Fill color */
  fillColor?: string;
}

/**
 * Factory functions for creating commands
 */
export const RenderCommandFactory = {
  createStrokeCommand(
    geometry: Geometry,
    style: Partial<RenderStyle>,
    strokeId?: string,
    segmentIndex?: number
  ): StrokeCommand {
    return {
      type: 'stroke',
      zIndex: 0,
      geometry,
      style: {
        color: '#000000',
        lineWidth: 2,
        lineStyle: 'solid',
        opacity: 1,
        ...style,
      },
      strokeId,
      segmentIndex,
    };
  },

  createPreviewCommand(
    geometry: Geometry,
    style: Partial<RenderStyle>
  ): PreviewCommand {
    return {
      type: 'preview',
      zIndex: 10,
      geometry,
      style: {
        color: '#666666',
        lineWidth: 2,
        lineStyle: 'dashed',
        opacity: 0.6,
        ...style,
      },
    };
  },

  createHighlightCommand(
    geometry: Geometry,
    isSelected: boolean,
    isHovered: boolean,
    strokeId?: string,
    segmentIndex?: number
  ): HighlightCommand {
    const baseWidth = 2;
    const hoverWidth = baseWidth + 2;
    const selectWidth = baseWidth + 3;
    
    return {
      type: 'highlight',
      zIndex: 20,
      geometry,
      style: {
        color: isSelected ? '#2196f3' : isHovered ? '#ff5722' : '#000000',
        lineWidth: isSelected ? selectWidth : isHovered ? hoverWidth : baseWidth,
        lineStyle: 'solid',
        opacity: 1,
      },
      isSelected,
      isHovered,
      strokeId,
      segmentIndex,
    };
  },

  createIndicatorCommand(
    point: Point,
    indicatorType: 'endpoint' | 'control' | 'cross',
    isSelected: boolean,
    isHovered: boolean
  ): IndicatorCommand {
    const size = indicatorType === 'endpoint' ? 6 : 4;
    const selectedSize = size + 2;
    
    return {
      type: 'indicator',
      zIndex: 30,
      geometry: { type: 'point', point },
      style: {
        color: isSelected ? '#2196f3' : isHovered ? '#ff5722' : '#2196f3',
        lineWidth: isSelected ? selectedSize : size,
        lineStyle: 'solid',
        opacity: 1,
        size: isSelected ? selectedSize : size,
      },
      indicatorType,
    };
  },

  createLabelCommand(
    text: string,
    position: Point,
    style: Partial<RenderStyle>
  ): LabelCommand {
    return {
      type: 'label',
      zIndex: 40,
      geometry: { type: 'point', point: position },
      text,
      position,
      style: {
        color: '#000000',
        lineWidth: 1,
        lineStyle: 'solid',
        opacity: 1,
        ...style,
      },
    };
  },

  createClosedAreaCommand(
    points: Point[],
    style: Partial<RenderStyle>,
    pattern?: 'hatch' | 'grid' | 'dots' | 'solid'
  ): ClosedAreaCommand {
    return {
      type: 'closedArea',
      zIndex: -5, // Below strokes
      geometry: { type: 'polygon', points },
      style: {
        color: 'rgba(200, 200, 200, 0.3)',
        lineWidth: 1,
        lineStyle: 'solid',
        opacity: 0.3,
        ...style,
      },
      pattern,
    };
  },
};

/**
 * Default Z-index values for command ordering
 */
export const Z_INDICES = {
  CLOSED_AREA: -5,    // Background fill
  GRID: -1,           // Grid lines
  STROKE: 0,          // Final strokes
  PREVIEW: 10,        // Drawing previews
  HIGHLIGHT: 20,      // Hover/select highlights
  INDICATOR: 30,      // Endpoint/control point indicators
  LABEL: 40,          // Text labels
  UI: 50,             // UI elements
};

/**
 * Default visual theme constants
 */
export const VISUAL_THEME = {
  // Colors
  HOVER_COLOR: '#ff5722',
  SELECT_COLOR: '#2196f3',
  PREVIEW_COLOR: '#666666',
  
  // Line widths
  BASE_WIDTH: 2,
  HOVER_WIDTH_ADD: 2,
  SELECT_WIDTH_ADD: 3,
  
  // Opacity
  PREVIEW_OPACITY: 0.6,
  
  // Dash pattern [dash, gap] in pixels
  DASH_PATTERN: [6, 4],
  
  // Indicator sizes
  ENDPOINT_SIZE: 6,
  CONTROL_POINT_SIZE: 4,
  
  // Z-indices
  Z: Z_INDICES,
};
