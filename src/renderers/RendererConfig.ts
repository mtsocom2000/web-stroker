/**
 * Renderer Visual Configuration
 * 
 * Shared visual constants and drawing options used by both
 * Canvas2DRenderer and WebGLRenderer to ensure consistent appearance.
 */

/**
 * Visual theme colors and constants
 * Centralized to ensure both renderers use identical values
 */
export const VISUAL_THEME = {
  // Selection/Highlight colors
  HOVER_COLOR: '#ff5722',      // Orange for hover state
  SELECT_COLOR: '#2196f3',     // Blue for select state
  
  // Line width adjustments
  HOVER_WIDTH_ADD: 2,          // Additional width for hover
  SELECT_WIDTH_ADD: 3,         // Additional width for select
  
  // Preview styling (dashed lines)
  PREVIEW_OPACITY: 0.6,
  DASH_PATTERN: [6, 4],        // [dash length, gap length] in pixels
  
  // Indicator styling
  ENDPOINT_SIZE: 5,
  CONTROL_POINT_SIZE: 6,
  INDICATOR_BORDER_COLOR: '#ffffff',
  INDICATOR_BORDER_WIDTH: 1,
  
  // Z-depth layers (for renderers that support it)
  Z_LAYERS: {
    GRID: -1,
    STROKES: 0.1,
    PREVIEWS: 0.05,
    HIGHLIGHTS: 0.15,
    INDICATORS: 0.2,
  },
} as const;

/**
 * Drawing style options
 * Used to configure how elements are rendered
 */
export interface DrawingStyle {
  /** Primary color (stroke color, line color) */
  color: string;
  /** Line thickness in pixels */
  thickness: number;
  /** Opacity from 0 to 1 */
  opacity?: number;
  /** Whether to use dashed line */
  dashed?: boolean;
  /** Dash pattern [dash length, gap length] */
  dashPattern?: [number, number];
}

/**
 * Highlight style options
 * Extends DrawingStyle with highlight-specific properties
 */
export interface HighlightStyle extends DrawingStyle {
  /** Whether the element is hovered */
  isHovered?: boolean;
  /** Whether the element is selected */
  isSelected?: boolean;
}

/**
 * Get the effective highlight style based on hover/select state
 * This logic is shared between both renderers
 */
export function getHighlightStyle(
  baseStyle: DrawingStyle,
  isHovered: boolean,
  isSelected: boolean
): DrawingStyle {
  if (isSelected) {
    return {
      ...baseStyle,
      color: VISUAL_THEME.SELECT_COLOR,
      thickness: baseStyle.thickness + VISUAL_THEME.SELECT_WIDTH_ADD,
    };
  }
  
  if (isHovered) {
    return {
      ...baseStyle,
      color: VISUAL_THEME.HOVER_COLOR,
      thickness: baseStyle.thickness + VISUAL_THEME.HOVER_WIDTH_ADD,
    };
  }
  
  return baseStyle;
}

/**
 * Get the preview style (dashed, semi-transparent)
 * This logic is shared between both renderers
 */
export function getPreviewStyle(
  baseStyle: DrawingStyle
): DrawingStyle {
  return {
    ...baseStyle,
    opacity: VISUAL_THEME.PREVIEW_OPACITY,
    dashed: true,
    dashPattern: VISUAL_THEME.DASH_PATTERN as [number, number],
  };
}

/**
 * Indicator style options
 */
export interface IndicatorStyle {
  /** Fill color */
  color: string;
  /** Size in pixels */
  size: number;
  /** Border color */
  borderColor?: string;
  /** Border width in pixels */
  borderWidth?: number;
}

/**
 * Get the endpoint indicator style
 */
export function getEndpointIndicatorStyle(
  baseColor: string,
  isHovered?: boolean,
  isSelected?: boolean
): IndicatorStyle {
  const color = isSelected 
    ? VISUAL_THEME.SELECT_COLOR 
    : isHovered 
    ? VISUAL_THEME.HOVER_COLOR 
    : baseColor;
  
  return {
    color,
    size: VISUAL_THEME.ENDPOINT_SIZE,
    borderColor: VISUAL_THEME.INDICATOR_BORDER_COLOR,
    borderWidth: VISUAL_THEME.INDICATOR_BORDER_WIDTH,
  };
}

/**
 * Get the control point indicator style
 */
export function getControlPointIndicatorStyle(
  baseColor: string,
  isHovered?: boolean,
  isSelected?: boolean
): IndicatorStyle {
  const color = isSelected 
    ? VISUAL_THEME.SELECT_COLOR 
    : isHovered 
    ? VISUAL_THEME.HOVER_COLOR 
    : baseColor;
  
  return {
    color,
    size: VISUAL_THEME.CONTROL_POINT_SIZE,
    borderColor: VISUAL_THEME.INDICATOR_BORDER_COLOR,
    borderWidth: VISUAL_THEME.INDICATOR_BORDER_WIDTH,
  };
}

/**
 * Drawing options for digital elements
 * Encapsulates all styling information needed to draw a digital element
 */
export interface DigitalDrawingOptions {
  /** The element's base style */
  baseStyle: DrawingStyle;
  /** Current interaction state */
  state: {
    isHovered: boolean;
    isSelected: boolean;
  };
  /** Whether this is a preview (incomplete drawing) */
  isPreview?: boolean;
}

/**
 * Get the final drawing style based on options
 * This is the main function both renderers should use
 */
export function resolveDrawingStyle(options: DigitalDrawingOptions): DrawingStyle {
  let style = options.baseStyle;
  
  // Apply highlight if hovered or selected
  if (options.state.isHovered || options.state.isSelected) {
    style = getHighlightStyle(style, options.state.isHovered, options.state.isSelected);
  }
  
  // Apply preview styling if needed
  if (options.isPreview) {
    style = getPreviewStyle(style);
  }
  
  return style;
}

/**
 * Utility to convert hex color to RGB components
 * Useful for renderers that need RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Utility to convert hex color to normalized RGB (0-1)
 * Useful for WebGL renderers
 */
export function hexToNormalizedRgb(hex: string): { r: number; g: number; b: number } | null {
  const rgb = hexToRgb(hex);
  return rgb ? {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  } : null;
}
