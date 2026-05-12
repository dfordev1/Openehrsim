import React, { useState, useEffect } from 'react';
import { FileText, Save, History } from 'lucide-react';

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
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden flex flex-col h-[300px]">
        <div className="bg-clinical-bg p-3 border-b border-clinical-line flex justify-between items-center">
          <span className="text-[11px] font-bold text-clinical-slate uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-3 h-3" /> Progress Note
          </span>
          <button 
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1 bg-clinical-blue text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
          >
            <Save className="w-3 h-3" /> Save Note
          </button>
        </div>
        <textarea
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          placeholder="Document clinical assessment, differential, and plan..."
          className="flex-1 p-4 text-sm font-medium focus:outline-none bg-white resize-none"
        />
      </div>

      <div className="bg-clinical-surface border border-clinical-line rounded shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="bg-clinical-bg p-3 border-b border-clinical-line flex items-center gap-2">
          <History className="w-3 h-3 text-clinical-slate" />
          <span className="text-[11px] font-bold text-clinical-slate uppercase tracking-wider">Note History</span>
        </div>
        <div className="overflow-y-auto divide-y divide-clinical-line">
          {history.length === 0 ? (
            <div className="p-8 text-center text-clinical-slate opacity-40 text-[10px] uppercase font-bold tracking-widest">
              No previous notes for this shift
            </div>
          ) : (
            history.map((note, idx) => (
              <div key={idx} className="p-4 hover:bg-clinical-bg/30 transition-colors">
                <div className="text-[9px] font-bold text-clinical-slate mb-1">{note.timestamp}</div>
                <p className="text-xs text-clinical-ink leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
