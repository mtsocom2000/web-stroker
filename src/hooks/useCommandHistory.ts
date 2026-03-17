import { useCallback, useRef, useState } from 'react';
import type { Stroke, CanvasState } from '../types';
import {
  CommandHistory,
  AddStrokeCommand,
  RemoveStrokeCommand,
  UpdateStrokeCommand,
  ClearStrokesCommand,
  UpdateViewCommand,
  BatchCommand,
  type Command,
} from '../commands/Command';

interface UseCommandHistoryOptions {
  initialState: CanvasState;
  onStateChange: (state: CanvasState) => void;
}

interface UseCommandHistoryReturn {
  // State
  canUndo: boolean;
  canRedo: boolean;
  historyDepth: number;
  historyDescriptions: string[];
  
  // Actions
  executeCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  
  // Convenience commands
  addStroke: (stroke: Stroke) => void;
  removeStroke: (strokeId: string) => void;
  updateStroke: (strokeId: string, stroke: Stroke) => void;
  updateView: (zoom: number, panX: number, panY: number) => void;
  clearStrokes: () => void;
  batchCommands: (description: string, commands: Command[]) => void;
}

/**
 * Hook for managing command-based history
 * 
 * Wraps CommandHistory with React state integration
 * Provides convenience methods for common operations
 * 
 * @param options - Configuration options
 * @returns History state and control functions
 */
export function useCommandHistory(options: UseCommandHistoryOptions): UseCommandHistoryReturn {
  const { initialState, onStateChange } = options;
  
  const historyRef = useRef(new CommandHistory(100));
  const stateRef = useRef(initialState);
  
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyDepth, setHistoryDepth] = useState(0);
  const [historyDescriptions, setHistoryDescriptions] = useState<string[]>([]);

  const updateState = useCallback((newState: CanvasState) => {
    stateRef.current = newState;
    onStateChange(newState);
    
    // Update UI state
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
    setHistoryDepth(historyRef.current.getDepth());
    setHistoryDescriptions(historyRef.current.getHistoryDescriptions());
  }, [onStateChange]);

  const executeCommand = useCallback((command: Command) => {
    const newState = historyRef.current.execute(stateRef.current, command);
    updateState(newState);
  }, [updateState]);

  const undo = useCallback(() => {
    const result = historyRef.current.undo(stateRef.current);
    if (result.success) {
      updateState(result.state);
    }
  }, [updateState]);

  const redo = useCallback(() => {
    const result = historyRef.current.redo(stateRef.current);
    if (result.success) {
      updateState(result.state);
    }
  }, [updateState]);

  const clearHistory = useCallback(() => {
    historyRef.current.clear();
    setCanUndo(false);
    setCanRedo(false);
    setHistoryDepth(0);
    setHistoryDescriptions([]);
  }, []);

  // Convenience methods
  const addStroke = useCallback((stroke: Stroke) => {
    executeCommand(new AddStrokeCommand(stroke));
  }, [executeCommand]);

  const removeStroke = useCallback((strokeId: string) => {
    // Need to find the stroke first for proper undo
    const stroke = stateRef.current.strokes.find(s => s.id === strokeId);
    if (stroke) {
      executeCommand(new RemoveStrokeCommand(strokeId, stroke));
    }
  }, [executeCommand]);

  const updateStroke = useCallback((strokeId: string, stroke: Stroke) => {
    executeCommand(new UpdateStrokeCommand(strokeId, stroke));
  }, [executeCommand]);

  const updateView = useCallback((zoom: number, panX: number, panY: number) => {
    executeCommand(new UpdateViewCommand(zoom, panX, panY));
  }, [executeCommand]);

  const clearStrokes = useCallback(() => {
    executeCommand(new ClearStrokesCommand());
  }, [executeCommand]);

  const batchCommands = useCallback((description: string, commands: Command[]) => {
    executeCommand(new BatchCommand(description, commands));
  }, [executeCommand]);

  return {
    canUndo,
    canRedo,
    historyDepth,
    historyDescriptions,
    executeCommand,
    undo,
    redo,
    clearHistory,
    addStroke,
    removeStroke,
    updateStroke,
    updateView,
    clearStrokes,
    batchCommands,
  };
}
