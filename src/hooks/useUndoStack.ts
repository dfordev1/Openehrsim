import { useState, useCallback, useRef } from 'react';
import type { MedicalCase } from '../types';

interface UndoEntry {
  id: string;
  label: string;
  caseSnapshot: MedicalCase;
  timestamp: number;
}

export function useUndoStack() {
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  // Mirror state in a ref so popUndo can synchronously return the popped entry
  const stackRef = useRef<UndoEntry[]>([]);

  const pushUndo = useCallback((label: string, caseSnapshot: MedicalCase) => {
    const entry: UndoEntry = {
      id: crypto.randomUUID(),
      label,
      caseSnapshot: JSON.parse(JSON.stringify(caseSnapshot)), // deep clone
      timestamp: Date.now(),
    };
    setUndoStack(prev => {
      const next = [...prev.slice(-19), entry]; // keep last 20
      stackRef.current = next;
      return next;
    });
  }, []);

  const popUndo = useCallback((): UndoEntry | null => {
    const current = stackRef.current;
    if (current.length === 0) return null;
    const popped = current[current.length - 1];
    const next = current.slice(0, -1);
    stackRef.current = next;
    setUndoStack(next);
    return popped;
  }, []);

  const canUndo = undoStack.length > 0;
  const lastAction = undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null;

  return { pushUndo, popUndo, canUndo, lastAction, undoStack };
}
