import { useState, useCallback, useRef } from 'react';
import type { MedicalCase } from '../types';

interface UndoEntry {
  id: string;
  label: string;
  caseSnapshot: MedicalCase;
  timestamp: number;
}

/**
 * Undo/redo stack for MedicalCase mutations.
 *
 * Semantics (matches a typical editor):
 * - `pushUndo(label, snapshot)` — records a new undoable edit and clears
 *   the redo stack (any future established by previous undos becomes
 *   invalid the moment a new divergent action is taken).
 * - `popUndo()` — pops the top of the undo stack and pushes it onto
 *   redo. Returns the popped entry so the caller can restore state.
 * - `popRedo()` — reverses `popUndo`, moving the top of redo back to
 *   undo and returning it.
 *
 * Both stacks are capped at 20 entries to bound memory.
 */

interface UndoRedoEntry extends UndoEntry {}

export function useUndoStack() {
  const [undoStack, setUndoStack] = useState<UndoRedoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoRedoEntry[]>([]);
  // Refs mirror state so pop operations can synchronously return a value.
  const undoRef = useRef<UndoRedoEntry[]>([]);
  const redoRef = useRef<UndoRedoEntry[]>([]);

  const pushUndo = useCallback((label: string, caseSnapshot: MedicalCase) => {
    const entry: UndoRedoEntry = {
      id: crypto.randomUUID(),
      label,
      caseSnapshot: JSON.parse(JSON.stringify(caseSnapshot)), // deep clone
      timestamp: Date.now(),
    };
    setUndoStack(prev => {
      const next = [...prev.slice(-19), entry]; // keep last 20
      undoRef.current = next;
      return next;
    });
    // Any new edit invalidates the redo history.
    if (redoRef.current.length > 0) {
      redoRef.current = [];
      setRedoStack([]);
    }
  }, []);

  const popUndo = useCallback((): UndoRedoEntry | null => {
    const current = undoRef.current;
    if (current.length === 0) return null;
    const popped = current[current.length - 1];
    const next = current.slice(0, -1);
    undoRef.current = next;
    setUndoStack(next);
    // Preserve the popped entry on the redo stack.
    const nextRedo = [...redoRef.current.slice(-19), popped];
    redoRef.current = nextRedo;
    setRedoStack(nextRedo);
    return popped;
  }, []);

  const popRedo = useCallback((): UndoRedoEntry | null => {
    const current = redoRef.current;
    if (current.length === 0) return null;
    const popped = current[current.length - 1];
    const next = current.slice(0, -1);
    redoRef.current = next;
    setRedoStack(next);
    // Move the popped entry back to the undo stack so another Cmd+Z
    // will revert it again.
    const nextUndo = [...undoRef.current.slice(-19), popped];
    undoRef.current = nextUndo;
    setUndoStack(nextUndo);
    return popped;
  }, []);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const lastAction = undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null;
  const nextRedoAction = redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null;

  return {
    pushUndo,
    popUndo,
    popRedo,
    canUndo,
    canRedo,
    lastAction,
    nextRedoAction,
    undoStack,
    redoStack,
  };
}
