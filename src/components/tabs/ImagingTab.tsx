import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileSearch, Clock, Plus, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from '../EmptyState';
import { MedicalCase } from '../../types';

interface ImagingTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  revealedStudies: string[];
  onRevealStudy: (type: string) => void;
  onOrderImaging: (name: string) => void;
}

export function ImagingTab({
  medicalCase,
  simTime,
  revealedStudies,
  onRevealStudy,
  onOrderImaging,
}: ImagingTabProps) {
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);

  const availableImaging = medicalCase.availableTests?.imaging ?? [];
  const orderedTypes = new Set((medicalCase.imaging || []).map(i => i.type));
  const unorderedImaging = availableImaging.filter(name => !orderedTypes.has(name));

  const activeStudy = medicalCase.imaging.find((img) => revealedStudies.includes(img.type));

  return (
    <motion.div key="imaging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">

      {/* ── Quick Order Panel ─────────────────────────────────────────── */}
      {unorderedImaging.length > 0 && (
        <div className="panel">
          <button
            onClick={() => setOrderPanelOpen(p => !p)}
            className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors"
          >
            <span className="panel-title flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-clinical-blue" />
              Order Imaging
              <span className="ml-1 text-[9px] bg-clinical-blue text-white rounded-full px-1.5 py-0.5">{unorderedImaging.length}</span>
            </span>
            <ChevronDown className={cn('w-4 h-4 text-clinical-slate/40 transition-transform', orderPanelOpen && 'rotate-180')} />
          </button>
          {orderPanelOpen && (
            <div className="p-3 flex flex-wrap gap-1.5">
              {unorderedImaging.map(name => (
                <button
                  key={name}
                  onClick={() => onOrderImaging(name)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-clinical-bg border border-clinical-line rounded-md text-xs font-medium hover:border-clinical-blue/50 hover:bg-clinical-blue/5 hover:text-clinical-blue transition-all"
                >
                  <Plus className="w-3 h-3" />{name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Worklist */}
        <div className="lg:col-span-1 panel flex flex-col min-h-[200px] max-h-[500px] lg:max-h-none">
          <div className="panel-header">
            <span className="panel-title">Imaging Worklist</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {medicalCase.imaging.map((img, i) => {
              const isAvailable =
                img.orderedAt !== undefined &&
                img.availableAt !== undefined &&
                img.availableAt <= simTime;
              const isPending =
                img.orderedAt !== undefined &&
                (img.availableAt === undefined || img.availableAt > simTime);

              return (
                <button
                  key={i}
                  onClick={() => isAvailable && onRevealStudy(img.type)}
                  className={cn(
                    'w-full text-left p-3 rounded-md border transition-all flex flex-col gap-1',
                    revealedStudies.includes(img.type)
                      ? 'bg-clinical-blue/10 text-clinical-blue border-clinical-blue/30'
                      : 'bg-clinical-surface border-clinical-line hover:border-clinical-blue/30',
                    isPending && 'bg-clinical-bg opacity-70',
                    !img.orderedAt && 'opacity-50'
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">{img.type}</span>
                    {isAvailable ? (
                      <div className="w-1.5 h-1.5 bg-clinical-green rounded-full" />
                    ) : isPending ? (
                      <Clock className="w-3 h-3 text-clinical-amber animate-spin" />
                    ) : (
                      <div className="w-1.5 h-1.5 bg-clinical-slate/30 rounded-full" />
                    )}
                  </div>
                  <div className="text-[10px] text-clinical-slate/60 flex justify-between">
                    <span>{isAvailable ? 'Completed' : isPending ? 'Pending...' : 'Unordered'}</span>
                    {img.orderedAt && <span>T+{img.orderedAt}m</span>}
                  </div>
                  {!img.orderedAt && (
                    <span
                      onClick={(e) => { e.stopPropagation(); onOrderImaging(img.type); }}
                      className="mt-1 text-[10px] text-clinical-blue font-medium hover:underline"
                    >
                      Place Order
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* DICOM Viewer */}
        <div className="lg:col-span-2 bg-[var(--color-panel-dark)] border border-[var(--color-panel-dark-border)] rounded-lg flex flex-col overflow-hidden text-slate-300 min-h-[300px]">
          <div className="bg-[#161820] p-2.5 border-b border-[var(--color-panel-dark-border)] flex items-center justify-between px-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">DICOM Viewer</span>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400/40" />
              <div className="w-2 h-2 rounded-full bg-amber-400/40" />
              <div className="w-2 h-2 rounded-full bg-green-400/40" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeStudy ? (
              <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
                <div className="border-b border-slate-700/50 pb-3">
                  <h1 className="text-lg font-semibold text-white">{activeStudy.type}</h1>
                  <p className="text-[10px] text-slate-500">
                    TECHNIQUE: {activeStudy.technique || 'Standard protocol with IV contrast'}
                  </p>
                </div>
                <section>
                  <h2 className="text-[10px] font-medium text-clinical-blue uppercase tracking-wide mb-2">Findings</h2>
                  <p className="text-sm border-l-2 border-slate-700 pl-4 leading-relaxed text-slate-400 whitespace-pre-line">
                    {activeStudy.findings || 'Reviewing data sequences...'}
                  </p>
                </section>
                <section className="bg-slate-800/50 p-4 rounded-lg border border-clinical-blue/20">
                  <h2 className="text-[10px] font-medium text-clinical-red uppercase tracking-wide mb-2">Impression</h2>
                  <p className="text-sm font-medium text-white">
                    {activeStudy.impression || 'Final report pending.'}
                  </p>
                </section>
              </div>
            ) : (
              <EmptyState
                icon={<FileSearch className="w-10 h-10" />}
                title="Awaiting selection"
                description="Select a completed study from the worklist."
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
