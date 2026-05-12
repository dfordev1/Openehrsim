import React from 'react';
import { motion } from 'motion/react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from '../EmptyState';
import { MedicalCase } from '../../types';

const STAFF_TARGETS = [
  'Nursing Station',
  'Radiology Desk',
  'Laboratory Tech',
  'Cardiology Consult',
  'Surgery Resident',
  'ICU Attending',
  'Pharmacy',
  'Social Work',
];

interface CommsTabProps {
  medicalCase: MedicalCase;
  callTarget: string;
  callMessage: string;
  calling: boolean;
  onSelectTarget: (target: string) => void;
  onMessageChange: (msg: string) => void;
  onSend: () => void;
}

export function CommsTab({
  medicalCase,
  callTarget,
  callMessage,
  calling,
  onSelectTarget,
  onMessageChange,
  onSend,
}: CommsTabProps) {
  return (
    <motion.div key="comms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {/* Directory */}
        <div className="md:col-span-1 panel">
          <div className="panel-header">
            <span className="panel-title">Directory</span>
          </div>
          <div className="p-3 space-y-0.5 max-h-[200px] overflow-y-auto" role="listbox" aria-label="Staff contacts">
            {STAFF_TARGETS.map((target) => (
              <button
                key={target}
                onClick={() => onSelectTarget(target)}
                role="option"
                aria-selected={callTarget === target}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-xs transition-colors',
                  callTarget === target
                    ? 'bg-clinical-blue/10 text-clinical-blue font-medium'
                    : 'text-clinical-slate hover:bg-clinical-bg'
                )}
              >
                {target}
              </button>
            ))}
          </div>
        </div>

        {/* Message composer */}
        <div className="md:col-span-2 panel">
          <div className="panel-header">
            <span className="panel-title">Call: {callTarget}</span>
          </div>
          <div className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={callMessage}
                onChange={(e) => onMessageChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSend()}
                placeholder={`Message for ${callTarget}...`}
                className="flex-1 bg-clinical-bg border border-clinical-line rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 transition-all"
              />
              <button
                onClick={onSend}
                disabled={calling || !callMessage}
                className="px-4 bg-clinical-blue text-white rounded-md font-medium text-xs hover:bg-clinical-blue/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Communication log */}
      <div className="flex-1 panel flex flex-col min-h-[250px]">
        <div className="panel-header">
          <span className="panel-title">Interaction History</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-clinical-bg/30">
          {(medicalCase.communicationLog || []).length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-10 h-10" />}
              title="No messages yet"
              description="Send a message to start communication."
            />
          ) : (
            medicalCase.communicationLog.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[80%] flex flex-col gap-1',
                  msg.from === 'You' || msg.from === 'Physician'
                    ? 'ml-auto items-end'
                    : 'mr-auto items-start'
                )}
              >
                <div className="text-[9px] font-medium text-clinical-slate px-1">
                  {msg.from} → {msg.to}
                </div>
                <div
                  className={cn(
                    'p-3 rounded-lg text-sm',
                    msg.from === 'You' || msg.from === 'Physician'
                      ? 'bg-clinical-blue text-white rounded-tr-sm'
                      : 'bg-clinical-surface border border-clinical-line rounded-tl-sm text-clinical-ink'
                  )}
                >
                  {msg.message}
                </div>
                <div className="text-[9px] text-clinical-slate/50 font-mono px-1">T+{msg.timestamp}m</div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
