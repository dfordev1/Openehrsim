import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Clipboard,
  Stethoscope,
  FlaskConical,
  FileSearch,
  Phone,
  Activity,
  PenTool,
  BookOpen,
  History,
  Pill,
  Sparkles,
  RefreshCw,
  Command,
  Clock,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onNewCase: () => void;
  onConsult: () => void;
  hasArchive: boolean;
  onOrderTest?: (type: 'lab' | 'imaging', name: string) => void;
  onAdminister?: (med: string) => void;
  onAdvanceTime?: (mins: number) => void;
}

export function CommandPalette({ isOpen, onClose, onNavigate, onNewCase, onConsult, hasArchive, onOrderTest, onAdminister, onAdvanceTime }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { id: 'hpi', label: 'Go to History & Intake', icon: <Clipboard className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('hpi') },
    { id: 'exam', label: 'Go to Physical Exam', icon: <Stethoscope className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('exam') },
    { id: 'labs', label: 'Go to Lab Results', icon: <FlaskConical className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('labs') },
    { id: 'imaging', label: 'Go to Radiology PACS', icon: <FileSearch className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('imaging') },
    { id: 'pharmacy', label: 'Go to Pharmacy', icon: <Pill className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('pharmacy') },
    { id: 'comms', label: 'Go to Communication', icon: <Phone className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('comms') },
    { id: 'treatment', label: 'Go to Interventions', icon: <Activity className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('treatment') },
    { id: 'notes', label: 'Go to Clinical Notes', icon: <PenTool className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('notes') },
    { id: 'tools', label: 'Go to Guidelines', icon: <BookOpen className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('tools') },
    ...(hasArchive ? [{ id: 'archive', label: 'Go to Clinical Archive', icon: <History className="w-4 h-4" />, category: 'Navigation', action: () => onNavigate('archive') }] : []),
    { id: 'new-case', label: 'New Patient Case', icon: <RefreshCw className="w-4 h-4" />, category: 'Actions', action: onNewCase },
    { id: 'consult', label: 'AI Consultant', icon: <Sparkles className="w-4 h-4" />, category: 'Actions', action: onConsult },
    // ── Quick clinical actions ──────────────────────────────────────────────
    ...(onOrderTest ? [
      { id: 'order-cbc',  label: 'Order CBC',          icon: <FlaskConical className="w-4 h-4" />, category: 'Quick Orders', action: () => { onOrderTest('lab', 'CBC'); } },
      { id: 'order-bmp',  label: 'Order BMP',          icon: <FlaskConical className="w-4 h-4" />, category: 'Quick Orders', action: () => { onOrderTest('lab', 'BMP'); } },
      { id: 'order-trop', label: 'Order Troponin',     icon: <FlaskConical className="w-4 h-4" />, category: 'Quick Orders', action: () => { onOrderTest('lab', 'Troponin'); } },
      { id: 'order-bg',   label: 'Order Blood Glucose',icon: <FlaskConical className="w-4 h-4" />, category: 'Quick Orders', action: () => { onOrderTest('lab', 'BMP'); } },
      { id: 'order-ecg',  label: 'Order ECG',          icon: <Activity className="w-4 h-4" />, category: 'Quick Orders', action: () => { onOrderTest('imaging', 'ECG'); } },
      { id: 'order-cxr',  label: 'Order Chest X-ray',  icon: <Activity className="w-4 h-4" />, category: 'Quick Orders', action: () => { onOrderTest('imaging', 'Chest X-ray'); } },
    ] : []),
    ...(onAdminister ? [
      { id: 'give-aspirin', label: 'Administer Aspirin 324mg PO', icon: <Pill className="w-4 h-4" />, category: 'Quick Orders', action: () => { onAdminister('Aspirin 324mg PO'); } },
      { id: 'give-o2',      label: 'Start O₂ 4L/min NC',         icon: <Pill className="w-4 h-4" />, category: 'Quick Orders', action: () => { onAdminister('O2 4L via nasal cannula'); } },
      { id: 'give-ns',      label: 'Bolus NS 1L IV',              icon: <Pill className="w-4 h-4" />, category: 'Quick Orders', action: () => { onAdminister('NS 1L Bolus'); } },
      { id: 'give-epi',     label: 'Administer Epinephrine 1mg',  icon: <Pill className="w-4 h-4" />, category: 'Quick Orders', action: () => { onAdminister('Epinephrine 1mg'); } },
    ] : []),
    ...(onAdvanceTime ? [
      { id: 'advance-5',  label: 'Advance Time +5 min',  icon: <Clock className="w-4 h-4" />, category: 'Quick Orders', action: () => { onAdvanceTime(5); } },
      { id: 'advance-10', label: 'Advance Time +10 min', icon: <Clock className="w-4 h-4" />, category: 'Quick Orders', action: () => { onAdvanceTime(10); } },
      { id: 'advance-30', label: 'Advance Time +30 min', icon: <Clock className="w-4 h-4" />, category: 'Quick Orders', action: () => { onAdvanceTime(30); } },
    ] : []),
  ];

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      filtered[activeIndex].action();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, activeIndex, onClose]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        // parent handles opening
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="command-palette-overlay"
            aria-hidden="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="command-palette"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              <div className="flex items-center gap-3 px-5 border-b border-clinical-line">
                <Search className="w-4 h-4 text-clinical-slate/50 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or search..."
                  className="command-palette-input border-none!"
                  aria-label="Search commands"
                />
                <kbd className="hidden sm:inline text-[10px] font-mono text-clinical-slate/50 bg-clinical-bg px-1.5 py-0.5 rounded border border-clinical-line">esc</kbd>
              </div>
              <div className="command-palette-results">
                {filtered.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm text-clinical-slate/50">No results found</div>
                ) : (
                  <>
                    {['Navigation', 'Actions', 'Quick Orders'].map(category => {
                      const items = filtered.filter(c => c.category === category);
                      if (items.length === 0) return null;
                      return (
                        <div key={category}>
                          <div className="px-5 py-1.5 text-[10px] font-semibold text-clinical-slate/60 uppercase tracking-wider">{category}</div>
                          {items.map((item) => {
                            const globalIdx = filtered.indexOf(item);
                            return (
                              <button
                                key={item.id}
                                onClick={() => { item.action(); onClose(); }}
                                className={`command-palette-item w-full ${globalIdx === activeIndex ? 'active' : ''}`}
                              >
                                <span className="text-clinical-slate/60">{item.icon}</span>
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <div className="px-5 py-2 border-t border-clinical-line bg-clinical-bg/50 flex items-center gap-4 text-[10px] text-clinical-slate/50">
                <span className="flex items-center gap-1"><kbd className="font-mono bg-clinical-surface px-1 rounded border border-clinical-line">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="font-mono bg-clinical-surface px-1 rounded border border-clinical-line">↵</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="font-mono bg-clinical-surface px-1 rounded border border-clinical-line">esc</kbd> close</span>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
