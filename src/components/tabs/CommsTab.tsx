import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { MedicalCase } from '../../types';

const STAFF_TARGETS = [
  'Nursing',
  'Radiology',
  'Lab',
  'Cardiology',
  'Surgery',
  'ICU',
  'Pharmacy',
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
  medicalCase, callTarget, callMessage, calling,
  onSelectTarget, onMessageChange, onSend,
}: CommsTabProps) {
  return (
    <motion.div
      key="comms"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      {/* Target buttons */}
      <div>
        <p className="text-xs text-gray-400 mb-3">Who do you want to call?</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {STAFF_TARGETS.map((target) => (
            <button
              key={target}
              onClick={() => onSelectTarget(target)}
              className={
                target === callTarget
                  ? 'text-sm font-medium text-gray-900'
                  : 'text-sm text-gray-400 hover:text-gray-700 transition-colors'
              }
            >
              {target}
            </button>
          ))}
        </div>
      </div>

      {/* Message textarea */}
      <div>
        <textarea
          value={callMessage}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) onSend(); }}
          placeholder={`Message for ${callTarget}...`}
          rows={3}
          className="w-full bg-transparent border-b border-gray-200 pb-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none transition-colors"
        />
        <span className="text-xs text-gray-300 mt-1 block">⌘+Enter to send</span>
      </div>

      {/* Send button */}
      <div>
        <button
          onClick={onSend}
          disabled={calling || !callMessage}
          className="bg-gray-900 text-white text-sm px-5 py-2 rounded-full disabled:opacity-40 hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          {calling && <Loader2 className="w-3 h-3 animate-spin" />}
          Send
        </button>
      </div>

      {/* Message history */}
      {(medicalCase.communicationLog || []).length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-3">History</p>
          <div className="flex flex-col gap-2">
            {medicalCase.communicationLog.map((msg, i) => (
              <p key={i} className="text-sm text-gray-900 pl-4">
                <span className="text-gray-400 font-mono">T+{msg.timestamp}m</span>
                {' '}
                <span className="text-gray-500">{msg.from} → {msg.to}</span>
                {' — '}
                {msg.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {(medicalCase.communicationLog || []).length === 0 && (
        <p className="text-sm text-gray-300 italic">No messages yet.</p>
      )}
    </motion.div>
  );
}
