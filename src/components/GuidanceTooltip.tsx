import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import type { WorkflowStage } from '../types';

interface GuidanceTip {
  stage: WorkflowStage;
  index: number;
  total: number;
  text: string;
}

const GUIDANCE_TIPS: GuidanceTip[] = [
  { stage: 'triage', index: 1, total: 4, text: 'Review the patient\'s chief concern and vital signs. Flag any abnormal values that may guide your initial assessment.' },
  { stage: 'triage', index: 2, total: 4, text: 'Check off findings that are important to your differential. Use the Diagnosis Pad to start tracking.' },
  { stage: 'triage', index: 3, total: 4, text: 'Your data acquisition will be compared to an expert\'s at the end. Select findings deliberately.' },
  { stage: 'triage', index: 4, total: 4, text: 'When ready, proceed to History to gather more clinical data.' },
  { stage: 'history', index: 1, total: 3, text: 'Review past medical, social, and family histories. Remember to select relevant data as you find them.' },
  { stage: 'history', index: 2, total: 3, text: 'The Review of Systems helps identify symptoms across organ systems. Focus on pertinent positives and negatives.' },
  { stage: 'history', index: 3, total: 3, text: 'Update your problem representation and differential as new information emerges.' },
  { stage: 'exam', index: 1, total: 2, text: 'Based on your hypothesis, select data from the relevant organ systems. Not every system needs to be examined.' },
  { stage: 'exam', index: 2, total: 2, text: 'Update your problem representation and differential based on exam findings.' },
  { stage: 'diagnostics', index: 1, total: 2, text: 'Order labs and imaging guided by your differential. Efficiency matters — avoid unnecessary tests.' },
  { stage: 'diagnostics', index: 2, total: 2, text: 'Review results carefully. Abnormal values should be added to your findings.' },
  { stage: 'dxpause', index: 1, total: 2, text: 'This is your reflection checkpoint. Consolidate your reasoning before management.' },
  { stage: 'dxpause', index: 2, total: 2, text: 'Place findings into the illness script builder to distinguish among your top diagnoses.' },
  { stage: 'management', index: 1, total: 1, text: 'Execute your management plan. Your interventions, timing, and outcomes will be scored.' },
];

interface GuidanceTooltipProps {
  currentStage: WorkflowStage;
  enabled: boolean;
  onDisable: () => void;
}

export function GuidanceTooltip({ currentStage, enabled, onDisable }: GuidanceTooltipProps) {
  const [currentTipIdx, setCurrentTipIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Reset tip index when stage changes
  useEffect(() => {
    setCurrentTipIdx(0);
    setDismissed(false);
  }, [currentStage]);

  if (!enabled || dismissed) return null;

  const stageTips = GUIDANCE_TIPS.filter(t => t.stage === currentStage);
  if (stageTips.length === 0) return null;

  const tip = stageTips[currentTipIdx];
  if (!tip) return null;

  const hasNext = currentTipIdx < stageTips.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed bottom-24 right-6 z-[60] w-80 bg-white border-2 border-teal-300 rounded-xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-teal-50 px-4 py-2.5 flex items-center justify-between border-b border-teal-200">
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">
            {currentStage.toUpperCase()} ({tip.index}/{tip.total})
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-teal-100 rounded"
          >
            <X className="w-3.5 h-3.5 text-teal-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex gap-3">
            {/* Clinician avatar placeholder */}
            <div className="w-10 h-10 rounded-full bg-teal-100 border-2 border-teal-300 flex items-center justify-center shrink-0">
              <span className="text-lg">👩‍⚕️</span>
            </div>
            <p className="text-xs text-clinical-ink leading-relaxed">{tip.text}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-clinical-bg/30 border-t border-clinical-line/50 flex items-center justify-between">
          <button
            onClick={onDisable}
            className="text-[10px] text-clinical-slate hover:text-teal-700 font-medium flex items-center gap-1 transition-colors"
          >
            <EyeOff className="w-3 h-3" />
            TURN OFF GUIDANCE
          </button>
          {hasNext && (
            <button
              onClick={() => setCurrentTipIdx(prev => prev + 1)}
              className="text-[10px] font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 transition-colors"
            >
              NEXT TIP
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
