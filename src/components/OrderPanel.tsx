import React, { useState } from 'react';
import { FlaskConical, Camera, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface OrderPanelProps {
  availableTests: {
    labs: string[];
    imaging: string[];
  };
  currentSimTime: number;
  onOrderTest: (testType: 'lab' | 'imaging', testName: string) => Promise<void>;
  onAdvanceTime: (minutes: number) => Promise<void>;
  orderedTests: Array<{ name: string; type: 'lab' | 'imaging'; availableAt: number; orderedAt: number }>;
  isProcessing: boolean;
}

export function OrderPanel({ 
  availableTests, 
  currentSimTime, 
  onOrderTest, 
  onAdvanceTime,
  orderedTests,
  isProcessing 
}: OrderPanelProps) {
  const [selectedTab, setSelectedTab] = useState<'labs' | 'imaging' | 'time'>('labs');
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState<number>(15);

  const handleOrderTest = async (testName: string, testType: 'lab' | 'imaging') => {
    setSelectedTest(testName);
    try {
      await onOrderTest(testType, testName);
    } finally {
      setSelectedTest(null);
    }
  };

  const isTestOrdered = (testName: string) => {
    return orderedTests.some(t => t.name === testName);
  };

  const getTestStatus = (testName: string) => {
    const test = orderedTests.find(t => t.name === testName);
    if (!test) return null;
    
    if (test.availableAt <= currentSimTime) {
      return { status: 'ready', text: 'Results Ready', color: 'text-green-600' };
    } else {
      const timeLeft = test.availableAt - currentSimTime;
      return { status: 'pending', text: `${timeLeft} min`, color: 'text-amber-600' };
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Order Tests & Advance Time</span>
        <span className="text-xs text-clinical-blue font-mono">T+{currentSimTime} min</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-clinical-line">
        <button
          onClick={() => setSelectedTab('labs')}
          className={cn(
            'flex-1 px-4 py-2.5 text-xs font-medium transition-all',
            selectedTab === 'labs'
              ? 'text-clinical-blue border-b-2 border-clinical-blue bg-clinical-blue/5'
              : 'text-clinical-slate hover:text-clinical-ink hover:bg-clinical-bg'
          )}
        >
          <FlaskConical className="w-3.5 h-3.5 inline mr-1.5" />
          Labs
        </button>
        <button
          onClick={() => setSelectedTab('imaging')}
          className={cn(
            'flex-1 px-4 py-2.5 text-xs font-medium transition-all',
            selectedTab === 'imaging'
              ? 'text-clinical-blue border-b-2 border-clinical-blue bg-clinical-blue/5'
              : 'text-clinical-slate hover:text-clinical-ink hover:bg-clinical-bg'
          )}
        >
          <Camera className="w-3.5 h-3.5 inline mr-1.5" />
          Imaging
        </button>
        <button
          onClick={() => setSelectedTab('time')}
          className={cn(
            'flex-1 px-4 py-2.5 text-xs font-medium transition-all',
            selectedTab === 'time'
              ? 'text-clinical-blue border-b-2 border-clinical-blue bg-clinical-blue/5'
              : 'text-clinical-slate hover:text-clinical-ink hover:bg-clinical-bg'
          )}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          Time
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {selectedTab === 'labs' && (
            <motion.div
              key="labs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 gap-2"
            >
              {availableTests.labs.map((testName) => {
                const ordered = isTestOrdered(testName);
                const status = getTestStatus(testName);
                
                return (
                  <button
                    key={testName}
                    onClick={() => !ordered && handleOrderTest(testName, 'lab')}
                    disabled={ordered || isProcessing || selectedTest === testName}
                    className={cn(
                      'p-3 rounded-lg text-left text-sm transition-all border',
                      ordered
                        ? 'bg-clinical-bg border-clinical-line cursor-not-allowed opacity-70'
                        : 'bg-clinical-surface border-clinical-line hover:border-clinical-blue hover:bg-clinical-blue/5',
                      selectedTest === testName && 'border-clinical-blue bg-clinical-blue/10'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('font-medium', ordered && 'text-clinical-slate')}>
                        {testName}
                      </span>
                      {selectedTest === testName && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-clinical-blue" />
                      )}
                      {status && status.status === 'ready' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      )}
                      {status && status.status === 'pending' && (
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      )}
                    </div>
                    {status && (
                      <div className={cn('text-xs mt-1', status.color)}>
                        {status.text}
                      </div>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}

          {selectedTab === 'imaging' && (
            <motion.div
              key="imaging"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 gap-2"
            >
              {availableTests.imaging.map((testName) => {
                const ordered = isTestOrdered(testName);
                const status = getTestStatus(testName);
                
                return (
                  <button
                    key={testName}
                    onClick={() => !ordered && handleOrderTest(testName, 'imaging')}
                    disabled={ordered || isProcessing || selectedTest === testName}
                    className={cn(
                      'p-3 rounded-lg text-left text-sm transition-all border',
                      ordered
                        ? 'bg-clinical-bg border-clinical-line cursor-not-allowed opacity-70'
                        : 'bg-clinical-surface border-clinical-line hover:border-clinical-blue hover:bg-clinical-blue/5',
                      selectedTest === testName && 'border-clinical-blue bg-clinical-blue/10'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('font-medium', ordered && 'text-clinical-slate')}>
                        {testName}
                      </span>
                      {selectedTest === testName && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-clinical-blue" />
                      )}
                      {status && status.status === 'ready' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      )}
                      {status && status.status === 'pending' && (
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      )}
                    </div>
                    {status && (
                      <div className={cn('text-xs mt-1', status.color)}>
                        {status.text}
                      </div>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}

          {selectedTab === 'time' && (
            <motion.div
              key="time"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-clinical-bg/50 p-3 rounded-lg border border-clinical-line">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-clinical-slate uppercase">Current Simulation Time</span>
                  <span className="text-2xl font-mono font-bold text-clinical-blue">
                    {Math.floor(currentSimTime / 60)}:{String(currentSimTime % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="text-xs text-clinical-slate">
                  {currentSimTime} minutes elapsed
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-clinical-slate uppercase mb-2 block">
                  Quick Advance
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 15, 30, 60].map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => onAdvanceTime(minutes)}
                      disabled={isProcessing}
                      className="p-3 bg-clinical-surface border border-clinical-line hover:border-clinical-blue hover:bg-clinical-blue/5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    >
                      +{minutes}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-clinical-slate uppercase mb-2 block">
                  Custom Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={customTime}
                    onChange={(e) => setCustomTime(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-clinical-bg border border-clinical-line rounded-lg text-sm focus:outline-none focus:border-clinical-blue"
                    placeholder="Minutes"
                  />
                  <button
                    onClick={() => onAdvanceTime(customTime)}
                    disabled={isProcessing || customTime < 1}
                    className="px-6 py-2 bg-clinical-blue text-white rounded-lg text-sm font-medium hover:bg-clinical-blue/90 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Advance'
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200">
                    <strong>Note:</strong> Patient condition evolves with time. Untreated conditions may worsen.
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
