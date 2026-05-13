import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FlaskConical, ChevronRight, Plus, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from '../EmptyState';
import { MedicalCase, LabResult } from '../../types';

interface LabsTabProps {
  medicalCase: MedicalCase;
  simTime: number;
  selectedLab: LabResult | null;
  onSelectLab: (lab: LabResult) => void;
  onOrderLab: (name: string) => void;
}

export function LabsTab({ medicalCase, simTime, selectedLab, onSelectLab, onOrderLab }: LabsTabProps) {
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);

  const availableLabs = medicalCase.availableTests?.labs ?? [];
  const orderedLabNames = new Set((medicalCase.labs || []).map(l => l.name));
  const unorderedLabs = availableLabs.filter(name => !orderedLabNames.has(name));

  return (
    <motion.div key="labs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">

      {/* ── Quick Order Panel ─────────────────────────────────────────── */}
      {unorderedLabs.length > 0 && (
        <div className="panel">
          <button
            onClick={() => setOrderPanelOpen(p => !p)}
            className="panel-header w-full cursor-pointer hover:bg-clinical-bg/60 transition-colors"
          >
            <span className="panel-title flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-clinical-blue" />
              Order Labs
              <span className="ml-1 text-[9px] bg-clinical-blue text-white rounded-full px-1.5 py-0.5">{unorderedLabs.length}</span>
            </span>
            <ChevronDown className={cn('w-4 h-4 text-clinical-slate/40 transition-transform', orderPanelOpen && 'rotate-180')} />
          </button>
          {orderPanelOpen && (
            <div className="p-3 flex flex-wrap gap-1.5">
              {unorderedLabs.map(name => (
                <button
                  key={name}
                  onClick={() => onOrderLab(name)}
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
        {/* Lab Table */}
        <div className="lg:col-span-2 panel flex flex-col min-h-[300px]">
          <div className="panel-header">
            <span className="panel-title">Clinical Chemistry & Hematology</span>
            <span className="text-[10px] text-clinical-slate/50 hidden sm:inline">Specimen: Whole Blood / Plasma</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="clinical-table w-full" aria-label="Lab results">
              <thead className="sticky top-0 bg-clinical-surface z-10">
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reference</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {(medicalCase.labs || []).map((lab) => {
                  const isAvailable =
                    lab.orderedAt !== undefined &&
                    lab.availableAt !== undefined &&
                    lab.availableAt <= simTime;
                  const isPending =
                    lab.orderedAt !== undefined &&
                    (lab.availableAt === undefined || lab.availableAt > simTime);

                  return (
                    <tr
                      key={lab.name}
                      onClick={() => isAvailable && onSelectLab(lab)}
                      className={cn(
                        'transition-colors cursor-pointer',
                        selectedLab?.name === lab.name ? 'bg-clinical-blue/5' : 'hover:bg-clinical-bg/50'
                      )}
                    >
                      <td className="font-medium text-clinical-ink">{lab.name}</td>
                      <td className="font-mono text-sm">
                        {isAvailable ? (
                          <span
                            className={cn(
                              lab.status === 'critical'
                                ? 'text-clinical-red font-semibold'
                                : lab.status === 'abnormal'
                                ? 'text-clinical-amber'
                                : ''
                            )}
                          >
                            {lab.value}
                          </span>
                        ) : (
                          <span className="opacity-20">---</span>
                        )}
                      </td>
                      <td>
                        {!lab.orderedAt ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOrderLab(lab.name); }}
                            className="text-[10px] font-medium text-clinical-blue hover:underline"
                          >
                            [Order]
                          </button>
                        ) : isPending ? (
                          <span
                            className="text-[10px] font-medium text-clinical-amber animate-pulse"
                            title={
                              lab.availableAt !== undefined
                                ? `Results expected at T+${lab.availableAt}m`
                                : undefined
                            }
                          >
                            {lab.availableAt !== undefined
                              ? `~${Math.max(1, lab.availableAt - simTime)}m ETA`
                              : 'Pending...'}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                lab.status === 'critical'
                                  ? 'bg-clinical-red'
                                  : lab.status === 'abnormal'
                                  ? 'bg-clinical-amber'
                                  : 'bg-clinical-green'
                              )}
                            />
                            <span className="text-[10px] text-clinical-slate/60 capitalize">{lab.status}</span>
                          </div>
                        )}
                      </td>
                      <td className="text-xs text-clinical-slate/70">
                        {lab.normalRange} {lab.unit}
                      </td>
                      <td>{isAvailable && <ChevronRight className="w-3 h-3 opacity-30" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interpretation Panel */}
        <div className="lg:col-span-1 panel flex flex-col min-h-[250px]">
          <div className="panel-header">
            <span className="panel-title">Interpretation</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedLab ? (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <h4 className="text-[10px] font-medium text-clinical-slate uppercase mb-1">Component</h4>
                  <p className="text-base font-semibold">{selectedLab.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-clinical-bg/50 p-3 rounded-md">
                    <h5 className="text-[9px] font-medium text-clinical-slate uppercase mb-1">Current</h5>
                    <p className="font-mono text-lg font-semibold">{selectedLab.value}</p>
                  </div>
                  <div className="bg-clinical-bg/50 p-3 rounded-md">
                    <h5 className="text-[9px] font-medium text-clinical-slate uppercase mb-1">Status</h5>
                    <p
                      className={cn(
                        'text-xs font-medium capitalize',
                        selectedLab.status === 'critical'
                          ? 'text-clinical-red'
                          : selectedLab.status === 'abnormal'
                          ? 'text-clinical-amber'
                          : 'text-clinical-green'
                      )}
                    >
                      {selectedLab.status}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-medium text-clinical-slate uppercase mb-2">Comments</h4>
                  <p className="text-xs text-clinical-ink leading-relaxed border-l-2 border-clinical-blue/20 pl-3">
                    {selectedLab.clinicalNote || 'No morphological abnormalities noted.'}
                  </p>
                </div>
                <div className="pt-3 space-y-1.5 text-[10px] text-clinical-slate border-t border-clinical-line/50">
                  <div className="flex justify-between">
                    <span>Ordered:</span>
                    <span className="font-mono">T+{selectedLab.orderedAt}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verified:</span>
                    <span className="font-mono text-clinical-green">T+{selectedLab.availableAt}m</span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<FlaskConical className="w-10 h-10" />}
                title="Select a lab result"
                description="Click on a test row to view interpretation."
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
