import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Command,
  Lightbulb,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
} from 'lucide-react';
import { ONBOARDING_SEEN_KEY } from '../lib/constants';
import { cn } from '../lib/utils';

interface OnboardingTourProps {
  /** Show the tour even if the user has previously dismissed it. Used by
   *  a "Re-run tour" entry-point (if ever wired up in a help menu). */
  forceOpen?: boolean;
  /** Called when the user finishes or skips the tour. */
  onDone?: () => void;
}

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: <Stethoscope className="w-5 h-5 text-clinical-blue" />,
    title: 'Welcome to the OpenEHR Simulator',
    body: 'Work through realistic patient cases from triage to disposition. Your reasoning — not just your final answer — is scored.',
  },
  {
    icon: <Lightbulb className="w-5 h-5 text-clinical-teal" />,
    title: 'The Diagnosis Pad is always with you',
    body: 'Use it to build your problem representation, differential diagnoses, findings, and an illness script. On mobile it slides up as a bottom sheet.',
  },
  {
    icon: <Brain className="w-5 h-5 text-clinical-amber" />,
    title: 'Stage gates enforce good reasoning',
    body: 'Before advancing (e.g. History → Exam) you commit a snapshot of your thinking. Your differential must be broad early, narrow late.',
  },
  {
    icon: <Command className="w-5 h-5 text-clinical-slate" />,
    title: 'Move fast with keyboard shortcuts',
    body: 'Cmd/Ctrl + K opens the command palette. 1-9 jump between tabs. Cmd+Z undoes, Cmd+Shift+Z redoes. Press N for a new case.',
  },
];

export function OnboardingTour({ forceOpen, onDone }: OnboardingTourProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (typeof window !== 'undefined' && !window.localStorage.getItem(ONBOARDING_SEEN_KEY)) {
        // Defer one tick so the initial loading spinner isn't occluded
        const id = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(id);
      }
    } catch {
      // localStorage disabled — silently skip the tour
    }
  }, [forceOpen]);

  const close = (completed: boolean) => {
    setOpen(false);
    try {
      if (completed && typeof window !== 'undefined') {
        window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
      }
    } catch {
      /* ignore */
    }
    onDone?.();
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
            className="fixed inset-0 bg-clinical-ink/50 backdrop-blur-sm z-[200]"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            role="dialog"
            aria-modal="true"
            aria-label="Getting started"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,calc(100vw-2rem))] bg-clinical-surface border border-clinical-line rounded-xl shadow-2xl z-[201] overflow-hidden"
          >
            <div className="flex items-start gap-3 p-5 border-b border-clinical-line">
              <div className="w-10 h-10 rounded-lg bg-clinical-bg border border-clinical-line flex items-center justify-center shrink-0">
                {current.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-clinical-ink">{current.title}</h3>
                <p className="text-xs text-clinical-slate leading-relaxed mt-1">{current.body}</p>
              </div>
              <button
                onClick={() => close(false)}
                className="p-1.5 hover:bg-clinical-bg rounded-md text-clinical-slate transition-colors shrink-0"
                aria-label="Skip tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-5 py-3 bg-clinical-bg/40">
              {/* Dot indicator */}
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Tour progress">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === step}
                    aria-label={`Step ${i + 1}`}
                    onClick={() => setStep(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === step
                        ? 'w-6 bg-clinical-blue'
                        : 'w-1.5 bg-clinical-slate/30 hover:bg-clinical-slate/50',
                    )}
                  />
                ))}
                <span className="text-[10px] text-clinical-slate ml-2 font-mono">
                  {step + 1} / {STEPS.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="flex items-center gap-1 text-xs font-medium text-clinical-slate hover:text-clinical-ink disabled:opacity-30 transition-colors px-2 py-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                {isLast ? (
                  <button
                    onClick={() => close(true)}
                    className="flex items-center gap-1.5 bg-clinical-blue hover:bg-clinical-blue/90 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Start simulating
                  </button>
                ) : (
                  <button
                    onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                    className="flex items-center gap-1.5 bg-clinical-blue hover:bg-clinical-blue/90 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
