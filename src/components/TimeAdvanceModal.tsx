import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import type { MedicalCase } from '../types';

interface TimeAdvanceModalProps {
  medicalCase: MedicalCase;
  simTime: number;
  intervening: boolean;
  onAdvance: (minutes: number) => Promise<void>;
  onClose: () => void;
}

type AdvanceMode = 'in' | 'next' | 'asneeded';

function toMinutes(days: number, hours: number, mins: number) {
  return days * 1440 + hours * 60 + mins;
}

function nextPendingResult(medicalCase: MedicalCase, simTime: number): number | null {
  const times: number[] = [];
  for (const lab of medicalCase.labs ?? []) {
    if (typeof lab.availableAt === 'number' && lab.availableAt > simTime) {
      times.push(lab.availableAt);
    }
  }
  for (const img of medicalCase.imaging ?? []) {
    if (typeof img.availableAt === 'number' && img.availableAt > simTime) {
      times.push(img.availableAt);
    }
  }
  if (times.length === 0) return null;
  return Math.min(...times);
}

export function TimeAdvanceModal({ medicalCase, simTime, intervening, onAdvance, onClose }: TimeAdvanceModalProps) {
  const [mode, setMode] = useState<AdvanceMode>('in');
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(30);

  const nextAt = nextPendingResult(medicalCase, simTime);
  const nextDelta = nextAt !== null ? nextAt - simTime : null;

  function computeAdvance(): number | null {
    if (mode === 'in') {
      const total = toMinutes(days, hours, mins);
      return total > 0 ? total : null;
    }
    if (mode === 'next') return nextDelta;
    if (mode === 'asneeded') return 5;
    return null;
  }

  async function handleOk() {
    const advance = computeAdvance();
    if (advance == null || advance <= 0) return;
    await onAdvance(advance);
    onClose();
  }

  const advance = computeAdvance();
  const okDisabled = intervening || advance == null || advance <= 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest">
            Obtain Results or See Patient Later
          </h2>

          {/* Mode selector */}
          <div className="space-y-2">
            {/* Advance by duration */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="in"
                checked={mode === 'in'}
                onChange={() => setMode('in')}
                className="mt-0.5 accent-gray-900"
              />
              <div className="flex-1">
                <span className="text-sm text-gray-700">Advance by duration</span>
                {mode === 'in' && (
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Days</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={days}
                        onChange={e => setDays(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                        className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-gray-900"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Hours</span>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={hours}
                        onChange={e => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                        className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-gray-900"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Mins</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        step={5}
                        value={mins}
                        onChange={e => setMins(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-gray-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>

            {/* With next available result */}
            <label className={cn(
              'flex items-start gap-3',
              nextDelta !== null ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
            )}>
              <input
                type="radio"
                name="mode"
                value="next"
                checked={mode === 'next'}
                onChange={() => setMode('next')}
                disabled={nextDelta === null}
                className="mt-0.5 accent-gray-900"
              />
              <div>
                <span className="text-sm text-gray-700">With next available result</span>
                {nextDelta !== null && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    +{nextDelta} min (T+{nextAt})
                  </p>
                )}
                {nextDelta === null && (
                  <p className="text-xs text-gray-400 mt-0.5">No pending results</p>
                )}
              </div>
            </label>

            {/* Call/see me as needed */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="asneeded"
                checked={mode === 'asneeded'}
                onChange={() => setMode('asneeded')}
                className="mt-0.5 accent-gray-900"
              />
              <div>
                <span className="text-sm text-gray-700">Call/see me as needed</span>
                <p className="text-xs text-gray-400 mt-0.5">Advance +5 min; patient or staff will alert you</p>
              </div>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleOk}
              disabled={okDisabled}
              className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full disabled:opacity-30 transition-opacity"
            >
              {intervening ? 'Advancing…' : 'OK'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
