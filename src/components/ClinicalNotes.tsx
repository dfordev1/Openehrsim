import React, { useState, useEffect } from 'react';
import { FileText, Save, History } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface Note {
  timestamp: string;
  content: string;
}

export function ClinicalNotes() {
  const [currentNote, setCurrentNote] = useState('');
  const [history, setHistory] = useState<Note[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('clinical_notes_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleSave = () => {
    if (!currentNote.trim()) return;
    const newNote = {
      timestamp: new Date().toLocaleTimeString(),
      content: currentNote
    };
    const updated = [newNote, ...history];
    setHistory(updated);
    setCurrentNote('');
    localStorage.setItem('clinical_notes_history', JSON.stringify(updated));
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="panel flex flex-col h-[280px]">
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Progress Note
          </span>
          <button
            onClick={handleSave}
            disabled={!currentNote.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-clinical-blue text-white rounded-md text-xs font-medium hover:bg-clinical-blue/90 transition-all disabled:opacity-40"
          >
            <Save className="w-3 h-3" /> Save
          </button>
        </div>
        <textarea
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          placeholder="Document clinical assessment, differential, and plan..."
          className="flex-1 p-4 text-sm focus:outline-none bg-clinical-surface resize-none"
        />
      </div>

      <div className="panel flex flex-col flex-1">
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> Note History
          </span>
        </div>
        <div className="overflow-y-auto divide-y divide-clinical-line/50 flex-1">
          {history.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-10 h-10" />}
              title="No notes yet"
              description="Save a progress note to see it here."
            />
          ) : (
            history.map((note, idx) => (
              <div key={idx} className="p-4 hover:bg-clinical-bg/30 transition-colors">
                <div className="text-[10px] font-medium text-clinical-slate mb-1">{note.timestamp}</div>
                <p className="text-xs text-clinical-ink leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
