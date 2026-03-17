import type { Stroke, CanvasState } from '../types';

/**
 * Command Pattern for History Management
 * 
 * Each command encapsulates an action and its inverse,
 * allowing for proper undo/redo functionality.
 * 
 * Benefits:
 * - Memory-efficient: Only store command + params, not full state
 * - Extensible: Easy to add new command types
 * - Testable: Commands are pure operations
 * - Composable: Can chain commands into transactions
 */

/**
 * Base Command Interface
 * All commands must implement execute and inverse
 */
export interface Command {
  /** Unique identifier for the command */
  readonly id: string;
  /** Human-readable description for UI */
  readonly description: string;
  /** Timestamp when command was created */
  readonly timestamp: number;
  
  /**
   * Execute the command
   * @param state Current canvas state
   * @returns New canvas state after execution
   */
  execute(state: CanvasState): CanvasState;
  
  /**
   * Get the inverse command for undo
   * This allows command-specific undo logic
   */
  inverse(): Command;
}

/**
 * Command to add a stroke to the canvas
 */
export class AddStrokeCommand implements Command {
  readonly id: string;
  readonly description = 'Add stroke';
  readonly timestamp: number;
  readonly stroke: Stroke;

  constructor(stroke: Stroke) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.stroke = stroke;
  }

  execute(state: CanvasState): CanvasState {
    return {
      ...state,
      strokes: [...state.strokes, this.stroke],
    };
  }

  inverse(): Command {
    return new RemoveStrokeCommand(this.stroke.id);
  }
}

/**
 * Command to remove a stroke from the canvas
 */
export class RemoveStrokeCommand implements Command {
  readonly id: string;
  readonly description = 'Remove stroke';
  readonly timestamp: number;
  readonly strokeId: string;
  private strokeData: Stroke | null = null;

  constructor(strokeId: string, strokeData?: Stroke) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.strokeId = strokeId;
    this.strokeData = strokeData || null;
  }

  execute(state: CanvasState): CanvasState {
    const stroke = state.strokes.find(s => s.id === this.strokeId);
    if (stroke) {
      this.strokeData = stroke;
    }
    
    return {
      ...state,
      strokes: state.strokes.filter(s => s.id !== this.strokeId),
    };
  }

  inverse(): Command {
    if (!this.strokeData) {
      throw new Error('Cannot invert RemoveStrokeCommand without stroke data');
    }
    return new AddStrokeCommand(this.strokeData);
  }
}

/**
 * Command to update an existing stroke
 */
export class UpdateStrokeCommand implements Command {
  readonly id: string;
  readonly description = 'Update stroke';
  readonly timestamp: number;
  readonly strokeId: string;
  readonly newStroke: Stroke;
  private oldStroke: Stroke | null = null;

  constructor(strokeId: string, newStroke: Stroke) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.strokeId = strokeId;
    this.newStroke = newStroke;
  }

  execute(state: CanvasState): CanvasState {
    const index = state.strokes.findIndex(s => s.id === this.strokeId);
    if (index === -1) return state;
    
    this.oldStroke = state.strokes[index];
    
    const newStrokes = [...state.strokes];
    newStrokes[index] = this.newStroke;
    
    return {
      ...state,
      strokes: newStrokes,
    };
  }

  inverse(): Command {
    if (!this.oldStroke) {
      throw new Error('Cannot invert UpdateStrokeCommand without old stroke data');
    }
    return new UpdateStrokeCommand(this.strokeId, this.oldStroke);
  }
}

/**
 * Command to clear all strokes
 */
export class ClearStrokesCommand implements Command {
  readonly id: string;
  readonly description = 'Clear all strokes';
  readonly timestamp: number;
  private oldStrokes: Stroke[] = [];

  constructor() {
    this.id = generateCommandId();
    this.timestamp = Date.now();
  }

  execute(state: CanvasState): CanvasState {
    this.oldStrokes = [...state.strokes];
    
    return {
      ...state,
      strokes: [],
    };
  }

  inverse(): Command {
    return new RestoreStrokesCommand(this.oldStrokes);
  }
}

/**
 * Command to restore multiple strokes (used for undoing clear)
 */
export class RestoreStrokesCommand implements Command {
  readonly id: string;
  readonly description = 'Restore strokes';
  readonly timestamp: number;
  readonly strokes: Stroke[];

  constructor(strokes: Stroke[]) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.strokes = strokes;
  }

  execute(state: CanvasState): CanvasState {
    return {
      ...state,
      strokes: [...state.strokes, ...this.strokes],
    };
  }

  inverse(): Command {
    return new ClearStrokesCommand();
  }
}

/**
 * Command to update view state (zoom, pan)
 */
export class UpdateViewCommand implements Command {
  readonly id: string;
  readonly description = 'Update view';
  readonly timestamp: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  private oldZoom: number = 1;
  private oldPanX: number = 0;
  private oldPanY: number = 0;

  constructor(zoom: number, panX: number, panY: number) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.zoom = zoom;
    this.panX = panX;
    this.panY = panY;
  }

  execute(state: CanvasState): CanvasState {
    this.oldZoom = state.zoom;
    this.oldPanX = state.panX;
    this.oldPanY = state.panY;
    
    return {
      ...state,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
    };
  }

  inverse(): Command {
    return new UpdateViewCommand(this.oldZoom, this.oldPanX, this.oldPanY);
  }
}

/**
 * Batch multiple commands into a single transaction
 * Useful for operations that involve multiple changes
 */
export class BatchCommand implements Command {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  readonly commands: Command[];

  constructor(description: string, commands: Command[]) {
    this.id = generateCommandId();
    this.description = description;
    this.timestamp = Date.now();
    this.commands = commands;
  }

  execute(state: CanvasState): CanvasState {
    return this.commands.reduce((currentState, cmd) => {
      return cmd.execute(currentState);
    }, state);
  }

  inverse(): Command {
    // Reverse the commands and get their inverses
    const inverses = [...this.commands]
      .reverse()
      .map(cmd => cmd.inverse());
    
    return new BatchCommand(`Undo ${this.description}`, inverses);
  }
}

/**
 * History manager using Command pattern
 */
export class CommandHistory {
  private commands: Command[] = [];
  private index: number = -1;
  private maxSize: number = 100;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Execute a command and add it to history
   */
  execute(state: CanvasState, command: Command): CanvasState {
    // Remove any commands after current index (redo stack)
    this.commands = this.commands.slice(0, this.index + 1);
    
    // Execute command
    const newState = command.execute(state);
    
    // Add command to history
    this.commands.push(command);
    this.index++;
    
    // Trim if exceeding max size
    if (this.commands.length > this.maxSize) {
      this.commands.shift();
      this.index--;
    }
    
    return newState;
  }

  /**
   * Undo the last command
   */
  undo(state: CanvasState): { state: CanvasState; success: boolean } {
    if (this.index < 0) {
      return { state, success: false };
    }

    const command = this.commands[this.index];
    const inverseCommand = command.inverse();
    const newState = inverseCommand.execute(state);
    
    this.index--;
    
    return { state: newState, success: true };
  }

  /**
   * Redo the next command
   */
  redo(state: CanvasState): { state: CanvasState; success: boolean } {
    if (this.index >= this.commands.length - 1) {
      return { state, success: false };
    }

    this.index++;
    const command = this.commands[this.index];
    const newState = command.execute(state);
    
    return { state: newState, success: true };
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.index >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.index < this.commands.length - 1;
  }

  /**
   * Get current history depth
   */
  getDepth(): number {
    return this.index + 1;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.commands = [];
    this.index = -1;
  }

  /**
   * Get command descriptions for UI
   */
  getHistoryDescriptions(): string[] {
    return this.commands.map((cmd, i) => {
      const marker = i === this.index ? ' ← current' : '';
      return `${cmd.description}${marker}`;
    });
  }
}

// Helper function to generate unique command IDs
let commandIdCounter = 0;
function generateCommandId(): string {
  return `cmd-${Date.now()}-${commandIdCounter++}`;
}
