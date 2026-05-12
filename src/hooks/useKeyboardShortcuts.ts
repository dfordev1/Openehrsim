import { useEffect } from 'react';

type TabId = 'triage' | 'hpi' | 'exam' | 'labs' | 'imaging' | 'pharmacy' | 'treatment' | 'comms' | 'archive' | 'notes' | 'tools' | 'assess' | 'dxpause';

interface KeyboardShortcutsOptions {
  onTabChange: (tab: TabId) => void;
  onNewCase: () => void;
  onDiagnosis: () => void;
  onCommandPalette: () => void;
  onUndo: () => void;
  enabled: boolean;
}

const TAB_MAP: Record<string, TabId> = {
  '1': 'hpi',
  '2': 'exam',
  '3': 'labs',
  '4': 'imaging',
  '5': 'pharmacy',
  '6': 'treatment',
  '7': 'comms',
  '8': 'notes',
  '9': 'assess',
};

export function useKeyboardShortcuts({
  onTabChange,
  onNewCase,
  onDiagnosis,
  onCommandPalette,
  onUndo,
  enabled,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Cmd/Ctrl + K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onCommandPalette();
        return;
      }

      // Cmd/Ctrl + Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }

      // Number keys 1-9 for tab switching
      if (TAB_MAP[e.key] && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onTabChange(TAB_MAP[e.key]);
        return;
      }

      // N for new case
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onNewCase();
        return;
      }

      // D for diagnosis/assessment
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onDiagnosis();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onTabChange, onNewCase, onDiagnosis, onCommandPalette, onUndo]);
}
