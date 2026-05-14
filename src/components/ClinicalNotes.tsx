import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';

interface Note {
  id: string;
  timestamp: string;
  isoTime: string;
  content: string;
  label?: string;
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);

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

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, val);
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
    if (expanded === id) setExpanded(null);
  }, [history, expanded]);

  // ── Keyboard shortcut: Ctrl/Cmd+S to save ─────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Textarea */}
      <div>
        <textarea
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Document your thinking..."
          rows={8}
          className="w-full bg-transparent border-b border-clinical-line pb-2 text-sm text-clinical-ink placeholder:text-clinical-slate/50 focus:outline-none focus:border-clinical-teal resize-none leading-relaxed"
        />
      </div>

      {/* Save action */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!draft.trim()}
          className="text-sm text-clinical-ink hover:text-clinical-ink-muted disabled:text-clinical-slate/50 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
        <span className="text-xs text-clinical-slate/50">⌘S</span>
        {saved && <span className="text-xs text-clinical-slate">Saved</span>}
      </div>

      {/* Saved notes */}
      {history.length > 0 && (
        <div>
          <p className="text-xs text-clinical-slate mb-3">Saved notes</p>
          <div className="flex flex-col gap-2">
            {history.map((note) => (
              <div key={note.id}>
                <button
                  onClick={() => setExpanded(expanded === note.id ? null : note.id)}
                  className="text-sm text-clinical-ink hover:text-clinical-ink-muted transition-colors text-left"
                >
                  <span className="text-clinical-slate font-mono text-xs">{note.timestamp}</span>
                  {' — '}
                  {note.label}
                </button>

                {expanded === note.id && (
                  <div className="mt-2 pl-4">
                    <pre className="text-sm text-clinical-ink whitespace-pre-wrap font-sans leading-relaxed">
                      {note.content}
                    </pre>
                    <div className="flex gap-4 mt-3">
                      <button
                        onClick={() => { setDraft(note.content); setExpanded(null); }}
                        className="text-xs text-clinical-slate hover:text-clinical-ink transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-xs text-clinical-slate hover:text-clinical-ink transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
