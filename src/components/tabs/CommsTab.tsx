import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, MessageSquare, Send, ClipboardList } from 'lucide-react';
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

// SBAR quick-fill templates per target
const SBAR_TEMPLATES: Record<string, string> = {
  'Nursing Station':    'SBAR: Patient {name}, {age}y. Vitals: HR {hr}, BP {bp}, SpO₂ {spo2}%. Trend: {trend}. Please {action}.',
  'Radiology Desk':     'SBAR: Requesting {study} for {name}, {age}y. CC: {cc}. Clinical concern: {concern}. Urgency: STAT.',
  'Laboratory Tech':    'SBAR: Stat labs needed for {name}, {age}y. HR {hr}, BP {bp}. Please expedite {labs}.',
  'Cardiology Consult': 'SBAR: Consult for {name}, {age}y. CC: {cc}. HR {hr}, BP {bp}, SpO₂ {spo2}%. ECG/echo findings: {findings}. Clinical question: {question}.',
  'Surgery Resident':   'SBAR: Surgical consult for {name}, {age}y. CC: {cc}. Exam: {exam}. Requesting assessment and recommendations.',
  'ICU Attending':      'SBAR: Transfer request for {name}, {age}y. HR {hr}, BP {bp}, SpO₂ {spo2}%, Trend: {trend}. Reason: {reason}. Bed requested.',
  'Pharmacy':           'SBAR: Medication query for {name}, {age}y. Current meds: {meds}. Question: {question}.',
  'Social Work':        'SBAR: Social work referral for {name}, {age}y. Clinical situation: {cc}. Concern: {concern}. Please assess.',
};

function fillTemplate(template: string, mc: MedicalCase): string {
  return template
    .replace(/{name}/g,     mc.patientName || 'Patient')
    .replace(/{age}/g,      String(mc.age || ''))
    .replace(/{hr}/g,       String(mc.vitals?.heartRate || '--'))
    .replace(/{bp}/g,       mc.vitals?.bloodPressure || '--')
    .replace(/{spo2}/g,     String(mc.vitals?.oxygenSaturation || '--'))
    .replace(/{trend}/g,    mc.physiologicalTrend || 'stable')
    .replace(/{cc}/g,       mc.chiefComplaint || '')
    .replace(/{meds}/g,     (mc.medications || []).map(m => `${m.name} ${m.dose}`).join(', ') || 'None')
    .replace(/{labs}/g,     (mc.labs || []).filter(l => l.orderedAt !== undefined).map(l => l.name).join(', ') || 'ordered labs')
    .replace(/{findings}/g, '[describe findings]')
    .replace(/{exam}/g,     '[describe exam findings]')
    .replace(/{concern}/g,  '[describe concern]')
    .replace(/{question}/g, '[state your question]')
    .replace(/{reason}/g,   '[state reason for transfer]')
    .replace(/{action}/g,   '[state action needed]')
    .replace(/{study}/g,    '[imaging study]');
}

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
  const [sbarTooltip, setSbarTooltip] = useState(false);

  function handleSbarFill() {
    const template = SBAR_TEMPLATES[callTarget] ?? SBAR_TEMPLATES['Nursing Station'];
    const filled   = fillTemplate(template, medicalCase);
    onMessageChange(filled);
    setSbarTooltip(true);
    setTimeout(() => setSbarTooltip(false), 1500);
  }

  return (
    <motion.div key="comms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {/* Directory */}
        <div className="md:col-span-1 panel">
          <div className="panel-header">
            <span className="panel-title">Directory</span>
          </div>
          <div className="p-3 space-y-0.5 max-h-[220px] overflow-y-auto" role="listbox" aria-label="Staff contacts">
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
            {/* SBAR quick-fill */}
            <div className="relative">
              <button
                onClick={handleSbarFill}
                className="flex items-center gap-1.5 text-[10px] font-medium text-clinical-blue bg-clinical-blue/10 hover:bg-clinical-blue/20 px-2.5 py-1 rounded-md transition-colors"
                title="Pre-fill message with SBAR template for this recipient"
              >
                <ClipboardList className="w-3 h-3" />
                SBAR Fill
              </button>
              {sbarTooltip && (
                <span className="absolute right-0 top-7 text-[10px] bg-clinical-ink text-white px-2 py-1 rounded whitespace-nowrap z-10">
                  ✓ Template applied
                </span>
              )}
            </div>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={callMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) onSend(); }}
              placeholder={`Message for ${callTarget}… or click SBAR Fill for a template`}
              rows={3}
              className="w-full bg-clinical-bg border border-clinical-line rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-clinical-blue/50 focus:ring-1 focus:ring-clinical-blue/30 resize-none transition-all"
            />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-clinical-slate/50">⌘+Enter to send</span>
              <button
                onClick={onSend}
                disabled={calling || !callMessage}
                className="px-4 py-2 bg-clinical-blue text-white rounded-md font-medium text-xs hover:bg-clinical-blue/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Communication log */}
      <div className="flex-1 panel flex flex-col min-h-[250px]">
        <div className="panel-header">
          <span className="panel-title">Interaction History</span>
          <span className="text-[10px] text-clinical-slate/50">{(medicalCase.communicationLog || []).length} messages</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-clinical-bg/30">
          {(medicalCase.communicationLog || []).length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-10 h-10" />}
              title="No messages yet"
              description="Send a message or use SBAR Fill to start communication."
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
                <div className={cn(
                  'p-3 rounded-lg text-sm',
                  msg.from === 'You' || msg.from === 'Physician'
                    ? 'bg-clinical-blue text-white rounded-tr-sm'
                    : 'bg-clinical-surface border border-clinical-line rounded-tl-sm text-clinical-ink'
                )}>
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
