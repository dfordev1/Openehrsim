import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Save, History, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { EmptyState } from './EmptyState';

interface Note {
  id: string;
  timestamp: string;
  isoTime: string;
  content: string;
  label?: string;  // first line or auto-generated title
}

const STORAGE_KEY = 'clinical_notes_history_v2';
const DRAFT_KEY   = 'clinical_notes_draft';
const AUTOSAVE_MS = 1200;

function getLabel(content: string): string {
  const first = content.split('\n')[0].trim().slice(0, 60);
  return first || 'Untitled note';
}

export function ClinicalNotes() {
  const [draft, setDraft]       = useState('');
  const [history, setHistory]   = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [saved, setSaved]       = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load persisted data ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) setDraft(savedDraft);
    } catch {/* ignore parse errors */}
  }, []);

  // ── Auto-save draft ────────────────────────────────────────────────────
  const handleDraftChange = useCallback((val: string) => {
    setDraft(val);
    setSaved(false);
    setAutoSaved(false);

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, val);
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, AUTOSAVE_MS);
  }, []);

  // ── Save note ──────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!draft.trim()) return;
    const now = new Date();
    const newNote: Note = {
      id:        crypto.randomUUID(),
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
                 ' ' + now.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      isoTime:   now.toISOString(),
      content:   draft.trim(),
      label:     getLabel(draft),
    };
    const updated = [newNote, ...history];
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.removeItem(DRAFT_KEY);
    setDraft('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [draft, history]);

  // ── Delete note ────────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    const updated = history.filter(n => n.id !== id);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (selected?.id === id) setSelected(null);
  }, [history, selected]);

  // ── Keyboard shortcut: Ctrl/Cmd+S to save ─────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">

      {/* ── Compose area ──────────────────────────────────────────────── */}
      <div className="panel flex flex-col" style={{ minHeight: 240 }}>
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Progress Note
          </span>
          <div className="flex items-center gap-2">
            {autoSaved && !saved && (
              <span className="text-[10px] text-clinical-slate/60 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Draft saved
              </span>
            )}
            {saved && (
              <span className="text-[10px] text-clinical-green flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3 h-3" /> Note saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!draft.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-clinical-blue text-white rounded-md text-xs font-medium hover:bg-clinical-blue/90 transition-all disabled:opacity-40"
            >
              <Save className="w-3 h-3" /> Save
              <span className="text-white/50 text-[9px] hidden sm:inline ml-1">⌘S</span>
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"Document your clinical assessment...\n\nCC: \nHPI: \nExam: \nAssessment: \nPlan:"}
          className="flex-1 p-4 text-sm focus:outline-none bg-clinical-surface resize-none font-mono leading-relaxed"
          style={{ minHeight: 180 }}
        />
        <div className="px-4 py-2 border-t border-clinical-line/50 flex justify-between items-center">
          <span className="text-[10px] text-clinical-slate/50">
            {draft.length > 0 ? `${draft.length} chars · ${draft.split(/\s+/).filter(Boolean).length} words` : 'Start typing…'}
          </span>
          {draft.length > 0 && (
            <button
              onClick={() => { setDraft(''); localStorage.removeItem(DRAFT_KEY); }}
              className="text-[10px] text-clinical-slate/50 hover:text-clinical-red transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Note history / viewer ──────────────────────────────────────── */}
      <div className="panel flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="panel-header shrink-0">
          <span className="panel-title flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> Note History
          </span>
          <span className="text-[10px] text-clinical-slate/50">{history.length} note{history.length !== 1 ? 's' : ''}</span>
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-10 h-10" />}
            title="No notes yet"
            description="Save a progress note to see it here."
          />
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-clinical-line/50">
            {/* Sidebar list */}
            <div className="w-48 shrink-0 overflow-y-auto divide-y divide-clinical-line/50">
              {history.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setSelected(selected?.id === note.id ? null : note)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 hover:bg-clinical-bg/50 transition-colors',
                    selected?.id === note.id && 'bg-clinical-blue/5 border-r-2 border-clinical-blue'
                  )}
                >
                  <p className="text-[10px] font-semibold text-clinical-ink truncate">{note.label}</p>
                  <p className="text-[9px] text-clinical-slate mt-0.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 shrink-0" />{note.timestamp}
                  </p>
                </button>
              ))}
            </div>

            {/* Detail pane */}
            <div className="flex-1 overflow-y-auto p-4">
              {selected ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-clinical-ink">{selected.label}</p>
                      <p className="text-[10px] text-clinical-slate">{selected.timestamp}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { setDraft(selected.content); setSelected(null); }}
                        className="text-[10px] text-clinical-blue hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(selected.id)}
                        className="text-[10px] text-clinical-red/60 hover:text-clinical-red flex items-center gap-0.5 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs text-clinical-ink leading-relaxed whitespace-pre-wrap font-sans bg-clinical-bg/50 rounded-lg p-4 border border-clinical-line/50">
                    {selected.content}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2 opacity-50">
                  <FileText className="w-8 h-8 text-clinical-slate/30" />
                  <p className="text-xs text-clinical-slate">Select a note to view</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
