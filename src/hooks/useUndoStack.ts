import { useState, useCallback } from 'react';
import type { MedicalCase } from '../types';

interface UndoEntry {
  id: string;
  label: string;
  caseSnapshot: MedicalCase;
  timestamp: number;
}

export function useUndoStack() {
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  const pushUndo = useCallback((label: string, caseSnapshot: MedicalCase) => {
    const entry: UndoEntry = {
      id: crypto.randomUUID(),
      label,
      caseSnapshot: JSON.parse(JSON.stringify(caseSnapshot)), // deep clone
      timestamp: Date.now(),
    };
    setUndoStack(prev => [...prev.slice(-19), entry]); // keep last 20
  }, []);

  const popUndo = useCallback((): UndoEntry | null => {
    let popped: UndoEntry | null = null;
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      popped = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return popped;
  }, []);

  const canUndo = undoStack.length > 0;
  const lastAction = undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null;

  return { pushUndo, popUndo, canUndo, lastAction, undoStack };
}
