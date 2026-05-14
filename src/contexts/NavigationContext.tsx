/**
 * NavigationContext — tabs, sidebars, dark mode, keyboard shortcuts.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle2,
  Clipboard,
  FlaskConical,
  History,
  PenTool,
  Phone,
  Pill,
  Stethoscope,
} from 'lucide-react';
import { useUrlTab } from '../hooks/useUrlTab';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useCase } from './CaseContext';
import { useAuth } from './AuthContext';

// ── Types ───────────────────────────────────────────────────────────────────
type TabId = 'triage' | 'hpi' | 'exam' | 'labs' | 'orders' | 'pharmacy' | 'treatment' | 'comms' | 'archive' | 'notes' | 'tools' | 'assess' | 'dxpause';

export interface TabDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

export interface NavigationContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLibraryOpen: boolean;
  setIsLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCommandOpen: boolean;
  setIsCommandOpen: React.Dispatch<React.SetStateAction<boolean>>;
  primaryTabs: TabDef[];
  actionTabs: TabDef[];
  toolTabs: TabDef[];
  mobileNavTabs: TabDef[];
}

// ── Context ─────────────────────────────────────────────────────────────────
const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────
export function NavigationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { handleUndo, handleRedo, isConsultOpen, loadNewCase } = useCase();

  const [activeTab, setActiveTab] = useUrlTab();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Wrap loadNewCase call with closing the library
  const handleNewCaseFromLibrary = useCallback(() => {
    setIsLibraryOpen(true);
  }, []);

  useKeyboardShortcuts({
    onTabChange: setActiveTab,
    onNewCase: handleNewCaseFromLibrary,
    onDiagnosis: () => setActiveTab('assess'),
    onCommandPalette: () => setIsCommandOpen((p) => !p),
    onUndo: handleUndo,
    onRedo: handleRedo,
    enabled: !isCommandOpen && !isLibraryOpen && !isConsultOpen,
  });

  const primaryTabs: TabDef[] = [
    { id: 'triage',  icon: <AlertCircle className="w-4 h-4" />, label: 'Triage',  shortcut: '1' },
    { id: 'hpi',     icon: <Clipboard className="w-4 h-4" />,   label: 'History', shortcut: '2' },
    { id: 'exam',    icon: <Stethoscope className="w-4 h-4" />, label: 'Exam',    shortcut: '3' },
    { id: 'labs',    icon: <FlaskConical className="w-4 h-4" />, label: 'Tests',   shortcut: '4' },
  ];
  const actionTabs: TabDef[] = [
    { id: 'dxpause',   icon: <Brain className="w-4 h-4" />,     label: 'DxPause'  },
    { id: 'pharmacy',  icon: <Pill className="w-4 h-4" />,      label: 'Pharmacy' },
    { id: 'treatment', icon: <Activity className="w-4 h-4" />,  label: 'Orders'   },
    { id: 'comms',     icon: <Phone className="w-4 h-4" />,     label: 'Comms'    },
  ];
  const toolTabs: TabDef[] = [
    { id: 'assess', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Assessment' },
    { id: 'notes',  icon: <PenTool className="w-4 h-4" />,      label: 'Notes'      },
    { id: 'tools',  icon: <BookOpen className="w-4 h-4" />,     label: 'Guidelines' },
    ...(user ? [{ id: 'archive', icon: <History className="w-4 h-4" />, label: 'Archive' }] : []),
  ];
  const mobileNavTabs: TabDef[] = [
    { id: 'hpi',       icon: <Clipboard className="w-3.5 h-3.5" />,    label: 'Hx'   },
    { id: 'exam',      icon: <Stethoscope className="w-3.5 h-3.5" />,  label: 'PE'   },
    { id: 'labs',      icon: <FlaskConical className="w-3.5 h-3.5" />, label: 'Labs' },
    { id: 'treatment', icon: <Activity className="w-3.5 h-3.5" />,     label: 'Rx'   },
    { id: 'assess',    icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Dx'   },
  ];

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isSidebarOpen,
        setIsSidebarOpen,
        isLibraryOpen,
        setIsLibraryOpen,
        isCommandOpen,
        setIsCommandOpen,
        primaryTabs,
        actionTabs,
        toolTabs,
        mobileNavTabs,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
