import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { MedicalCase } from '../../types';
import { ActiveOrdersPanel } from '../ActiveOrdersPanel';

interface VitalsPoint { time: string; hr: number; sbp: number; rr: number; spo2: number; }

interface TreatmentTabProps {
  medicalCase: MedicalCase;
  vitalsHistory: VitalsPoint[];
  interventionInput: string;
  intervening: boolean;
  transferExpanded: boolean;
  simTime: number;
  onInterventionChange: (val: string) => void;
  onExecuteOrder: () => void;
  onWait: (minutes: number) => void;
  onTransfer: (dept: string) => void;
  onToggleTransfer: () => void;
  onOrderTest: (type: 'lab' | 'imaging', name: string) => Promise<void>;
  onAdvanceTime: (minutes: number) => Promise<void>;
  onDiscontinueMedication: (id: string, name: string) => Promise<void>;
}

export function TreatmentTab({
  medicalCase,
  vitalsHistory,
  interventionInput,
  intervening,
  transferExpanded,
  simTime,
  onInterventionChange,
  onExecuteOrder,
  onWait,
  onTransfer,
  onToggleTransfer,
  onOrderTest,
  onAdvanceTime,
  onDiscontinueMedication,
}: TreatmentTabProps) {
  const trend = medicalCase.physiologicalTrend;
  const penaltyLevel = simTime >= 90 ? 'high' : simTime >= 60 ? 'moderate' : simTime >= 45 ? 'low' : null;
  return (
    <motion.div
      key="treatment"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Vitals + trend */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400 font-mono">
          HR {medicalCase.vitals.heartRate} · BP {medicalCase.vitals.bloodPressure} · SpO2 {medicalCase.vitals.oxygenSaturation}% · RR {medicalCase.vitals.respiratoryRate} · {medicalCase.vitals.temperature}°C
        </p>
        {trend && trend !== 'stable' && (
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
            trend === 'improving'              && 'bg-green-50 text-green-600',
            trend === 'declining'              && 'bg-amber-50 text-amber-600',
            trend === 'critical'               && 'bg-red-50 text-red-600 animate-pulse',
          )}>
            {trend === 'improving' ? '↑ Improving' : trend === 'declining' ? '↓ Declining' : '⚠ Critical'}
          </span>
        )}
      </div>

      {/* Time pressure warning */}
      {penaltyLevel && (
        <p className={cn(
          'text-xs',
          penaltyLevel === 'low'      && 'text-amber-500',
          penaltyLevel === 'moderate' && 'text-orange-500',
          penaltyLevel === 'high'     && 'text-red-500 font-medium',
        )}>
          {penaltyLevel === 'low'      && `⏱ T+${simTime}m — efficiency score beginning to drop.`}
          {penaltyLevel === 'moderate' && `⏱ T+${simTime}m — significant time penalty accumulating.`}
          {penaltyLevel === 'high'     && `⏱ T+${simTime}m — major efficiency penalty. Expedite management.`}
        </p>
      )}

      {/* Hero: intervention input */}
      <div>
        <textarea
          value={interventionInput}
          onChange={(e) => onInterventionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (interventionInput.trim() && !intervening) onExecuteOrder();
            }
          }}
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

      {/* Active orders panel */}
      <ActiveOrdersPanel
        medicalCase={medicalCase}
        simTime={simTime}
        intervening={intervening}
        onDiscontinue={onDiscontinueMedication}
      />

      {/* Action log */}
      <div className="flex-1 min-h-0">
        {(medicalCase.clinicalActions || []).length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Activity log</p>
            {[...medicalCase.clinicalActions].reverse().map((action, i) => (
              <div key={i} className="flex gap-3 text-xs text-gray-400">
                <span className="font-mono shrink-0 text-gray-300">T+{action.timestamp}m</span>
                <span className="text-gray-500">{action.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
