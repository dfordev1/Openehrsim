import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { MedicalCase } from '../../types';

interface HpiTabProps {
  medicalCase: MedicalCase;
}

const SEVERITY_BADGE: Record<string, string> = {
  severe:   'bg-red-100 text-red-700 border-red-200',
  moderate: 'bg-amber-100 text-amber-700 border-amber-200',
  mild:     'bg-yellow-50 text-yellow-700 border-yellow-200',
};

export function HpiTab({ medicalCase }: HpiTabProps) {
  const pmh    = medicalCase.pastMedicalHistory || [];
  const pr     = medicalCase.priorRecords;
  const [open, setOpen] = useState(false);

  const hasMeds   = pr?.homeMedications && pr.homeMedications.length > 0;
  const hasAlg    = pr?.allergies && pr.allergies.length > 0;
  const hasBLabs  = pr?.baselineLabs && pr.baselineLabs.length > 0;
  const hasHosp   = pr?.priorHospitalizations && pr.priorHospitalizations.length > 0;
  const hasPrior  = hasMeds || hasAlg || hasBLabs || hasHosp;

  return (
    <motion.div
      key="hpi"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-10 py-8"
    >
      {/* ── History of present illness ─────────────────────────────────────── */}
      <p className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap">
        {medicalCase.historyOfPresentIllness}
      </p>

      {/* ── Past medical history ───────────────────────────────────────────── */}
      {pmh.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Past Medical History</p>
          <ul className="space-y-1">
            {pmh.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Management conflicts ───────────────────────────────────────────── */}
      {medicalCase.managementConflicts && medicalCase.managementConflicts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-700 uppercase tracking-wide">Active Management Conflicts</p>
          <ul className="space-y-1">
            {medicalCase.managementConflicts.map((c, i) => (
              <li key={i} className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                ⚠ {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Prior records (collapsible) ────────────────────────────────────── */}
      {hasPrior && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Prior Medical Records
            </span>
            <span className="text-gray-400 text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 space-y-6 border-t border-gray-200">

                  {/* Allergies */}
                  {hasAlg && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Allergies</p>
                      <div className="flex flex-wrap gap-2">
                        {pr!.allergies.map((a, i) => (
                          <span
                            key={i}
                            className={`text-xs border rounded px-2 py-1 font-medium ${SEVERITY_BADGE[a.severity] ?? SEVERITY_BADGE.mild}`}
                            title={`Reaction: ${a.reaction} — ${a.severity}`}
                          >
                            {a.agent}: {a.reaction}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Home medications */}
                  {hasMeds && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Home Medications</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="pb-1 font-medium text-gray-500 pr-3">Drug</th>
                              <th className="pb-1 font-medium text-gray-500 pr-3">Dose / Route</th>
                              <th className="pb-1 font-medium text-gray-500">Indication</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pr!.homeMedications.map((m, i) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 pr-3 font-medium text-gray-800">{m.name}</td>
                                <td className="py-1.5 pr-3 text-gray-600">{m.dose} {m.route}</td>
                                <td className="py-1.5 text-gray-500">{m.indication}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Baseline labs */}
                  {hasBLabs && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Baseline Labs (prior to admission)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {pr!.baselineLabs.map((b, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                            <p className="text-xs text-gray-500">{b.name}</p>
                            <p className="text-sm font-semibold text-gray-800">{b.value} <span className="text-xs font-normal text-gray-400">{b.unit}</span></p>
                            <p className="text-xs text-gray-400">{b.collectedDaysAgo}d ago</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prior hospitalizations */}
                  {hasHosp && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Prior Hospitalizations</p>
                      <ul className="space-y-1.5">
                        {pr!.priorHospitalizations.map((h, i) => (
                          <li key={i} className="text-xs text-gray-700 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                            <span className="font-medium">{h.daysAgo}d ago</span> — {h.reason}
                            {h.outcome && <span className="text-gray-500"> · {h.outcome}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
