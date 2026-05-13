import { motion } from 'motion/react';
import type {
  ClinicalFinding,
  DifferentialEntry,
  MedicalCase,
  IllnessScript,
  PRSnapshot,
} from '../../types';

interface DxPauseTabProps {
  medicalCase: MedicalCase;
  problemRepresentation: string;
  onProblemRepresentationChange: (val: string) => void;
  differentials: DifferentialEntry[];
  findings: ClinicalFinding[];
  prHistory: PRSnapshot[];
  prIsDirty: boolean;
  onUpdateFindingRelevanceForDx: (
    findingId: string,
    differentialId: string,
    relevance: 'positive' | 'negative' | 'none',
  ) => void;
  onSetIllnessScript: (id: string, script: IllnessScript) => void;
  onSetLead: (id: string) => void;
  onProceedToManagement: () => void;
  simTime: number;
}

export function DxPauseTab({
  problemRepresentation,
  onProblemRepresentationChange,
  differentials,
  onSetLead,
  onProceedToManagement,
}: DxPauseTabProps) {
  const prLen = problemRepresentation.trim().length;
  const canProceed = prLen >= 80 && differentials.length >= 2;
  const leadDx = differentials.find(d => d.isLead);

  return (
    <motion.div
      key="dxpause"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Section 1: Problem Representation */}
      <div>
        <p className="text-xs text-gray-400 mb-3">Problem representation</p>
        <textarea
          value={problemRepresentation}
          onChange={(e) => onProblemRepresentationChange(e.target.value)}
          placeholder="A [age]-year-old [gender] with [PMH] presenting with [duration] of [symptoms], notable for [key findings], most consistent with [leading diagnosis]..."
          rows={4}
          className="w-full bg-transparent border-b border-gray-200 pb-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none transition-colors leading-relaxed"
        />
        <span className="text-xs text-gray-300 mt-1 block">
          {prLen} chars{prLen < 80 ? ` — need at least 80` : ''}
        </span>
      </div>

      {/* Section 2: Differentials */}
      <div>
        <p className="text-xs text-gray-400 mb-3">
          Your differentials{differentials.length < 2 ? ' — add at least 2 in the Dx Pad' : ''}
        </p>
        {differentials.length === 0 ? (
          <p className="text-sm text-gray-300 italic">None yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {differentials.map((d, idx) => (
              <button
                key={d.id}
                onClick={() => onSetLead(d.id)}
                className="text-left text-sm text-gray-900 hover:text-gray-600 transition-colors"
              >
                {d.isLead ? '● ' : `${idx + 1}. `}
                {d.diagnosis}
                {d.isLead && (
                  <span className="text-xs text-gray-400 ml-2">lead</span>
                )}
              </button>
            ))}
          </div>
        )}
        {!leadDx && differentials.length >= 2 && (
          <p className="text-xs text-gray-400 mt-2">Tap a diagnosis to mark it as your lead.</p>
        )}
      </div>

      {/* Section 3: Proceed */}
      <div>
        <button
          onClick={onProceedToManagement}
          disabled={!canProceed}
          className="text-sm text-gray-900 hover:text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Proceed to Management →
        </button>
        {!canProceed && (
          <p className="text-xs text-gray-300 mt-1">
            Complete your problem representation (≥80 chars) and add ≥2 differentials.
          </p>
        )}
      </div>
    </motion.div>
  );
}
