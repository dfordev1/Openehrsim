import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { MedicalCase } from '../../types';

interface VitalsPoint { time: string; hr: number; sbp: number; rr: number; spo2: number; }

interface TreatmentTabProps {
  medicalCase: MedicalCase;
  vitalsHistory: VitalsPoint[];
  interventionInput: string;
  intervening: boolean;
  transferExpanded: boolean;
  onInterventionChange: (val: string) => void;
  onExecuteOrder: () => void;
  onWait: (minutes: number) => void;
  onTransfer: (dept: string) => void;
  onToggleTransfer: () => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onAdvanceTime: (minutes: number) => Promise<void>;
}

export function TreatmentTab({
  medicalCase,
  vitalsHistory,
  interventionInput,
  intervening,
  transferExpanded,
  onInterventionChange,
  onExecuteOrder,
  onWait,
  onTransfer,
  onToggleTransfer,
  onOrderTest,
  onAdvanceTime,
}: TreatmentTabProps) {
  return (
    <motion.div
      key="treatment"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Hero: intervention input */}
      <div>
        <textarea
          value={interventionInput}
          onChange={(e) => onInterventionChange(e.target.value)}
          placeholder="Describe your intervention..."
          className="w-full text-base border-b border-gray-200 py-3 px-1 focus:outline-none focus:border-gray-900 transition-colors bg-transparent resize-none leading-relaxed"
          rows={3}
        />
        <button
          onClick={onExecuteOrder}
          disabled={intervening || !interventionInput.trim()}
          className="mt-3 px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full disabled:opacity-30 transition-opacity"
        >
          Execute
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {[5, 15, 30].map(mins => (
          <button
            key={mins}
            onClick={() => onWait(mins)}
            disabled={intervening}
            className="text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-30"
          >
            +{mins} min
          </button>
        ))}
        <button
          onClick={onToggleTransfer}
          className="text-gray-400 hover:text-gray-900 transition-colors"
        >
          Transfer
        </button>
      </div>

      {/* Transfer options */}
      {transferExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap gap-3 text-sm"
        >
          {['ICU', 'OR', 'Cath Lab', 'Ward', 'Radiology'].map(dept => (
            <button
              key={dept}
              onClick={() => onTransfer(dept)}
              disabled={intervening}
              className="text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30"
            >
              {dept}
            </button>
          ))}
        </motion.div>
      )}

      {/* Action log */}
      <div className="flex-1 min-h-0">
        {(medicalCase.clinicalActions || []).length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {[...medicalCase.clinicalActions].reverse().map((action, i) => (
              <div key={i} className="flex gap-3 text-xs text-gray-400">
                <span className="font-mono shrink-0">T+{action.timestamp}m</span>
                <span className="text-gray-600">{action.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
