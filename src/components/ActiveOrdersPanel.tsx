import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import type { MedicalCase } from '../types';

interface ActiveOrdersPanelProps {
  medicalCase: MedicalCase;
  simTime: number;
  intervening: boolean;
  onDiscontinue: (id: string, name: string) => Promise<void>;
}

export function ActiveOrdersPanel({ medicalCase, simTime, intervening, onDiscontinue }: ActiveOrdersPanelProps) {
  const [open, setOpen] = useState(true);

  const activeMeds = (medicalCase.medications ?? []).filter(m => m.discontinuedAt == null);
  const pendingLabs = (medicalCase.labs ?? []).filter(
    l => l.orderedAt !== undefined && (l.availableAt === undefined || l.availableAt > simTime)
  );
  const pendingImaging = (medicalCase.imaging ?? []).filter(
    i => i.orderedAt !== undefined && (i.availableAt === undefined || i.availableAt > simTime)
  );

  const totalActive = activeMeds.length + pendingLabs.length + pendingImaging.length;

  if (totalActive === 0) return null;

  return (
    <div className="border border-clinical-line rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-clinical-line/30 transition-colors" style={{ background: 'var(--clinical-surface-raised)' }}
      >
        <span className="text-xs font-semibold text-clinical-slate uppercase tracking-widest">
          Active Orders
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-clinical-slate">{totalActive}</span>
          <span className="text-[10px] text-clinical-slate/50">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-clinical-line/50">
              {/* Active medications */}
              {activeMeds.map(med => (
                <div key={med.id} className="flex items-center justify-between px-4 py-2 group">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-clinical-ink truncate">{med.name}</p>
                    <p className="text-[10px] text-clinical-slate">
                      {[med.dose, med.route].filter(Boolean).join(' · ')}
                      {' '}· T+{med.timestamp}m
                    </p>
                  </div>
                  <button
                    onClick={() => onDiscontinue(med.id, med.name)}
                    disabled={intervening}
                    className={cn(
                      'ml-3 shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors disabled:opacity-30',
                      'border-clinical-red/30 text-clinical-red hover:bg-clinical-red-soft opacity-0 group-hover:opacity-100'
                    )}
                  >
                    D/C
                  </button>
                </div>
              ))}

              {/* Pending labs */}
              {pendingLabs.map((lab, i) => (
                <div key={`lab-${i}`} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <p className="text-xs text-clinical-ink">{lab.name}</p>
                    <p className="text-[10px] text-clinical-slate">Lab · pending T+{lab.availableAt ?? '?'}m</p>
                  </div>
                  <span className="text-[10px] font-mono text-clinical-amber">
                    {lab.availableAt != null ? `+${lab.availableAt - simTime}m` : 'pending'}
                  </span>
                </div>
              ))}

              {/* Pending imaging */}
              {pendingImaging.map((img, i) => (
                <div key={`img-${i}`} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <p className="text-xs text-clinical-ink">{img.type}</p>
                    <p className="text-[10px] text-clinical-slate">Imaging · pending T+{img.availableAt ?? '?'}m</p>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400">
                    {img.availableAt != null ? `+${img.availableAt - simTime}m` : 'pending'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
