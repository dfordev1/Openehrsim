import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { MedicalCase, CaseEvaluation } from '../types';

interface CaseExportProps {
  medicalCase: MedicalCase | null;
  feedback: { score: number; feedback: string } | null;
  logs: { time: string; text: string }[];
  evaluation?: CaseEvaluation | null;
}

// ── Markdown generator ────────────────────────────────────────────────────────
function generateMarkdown(
  mc: MedicalCase,
  feedback: { score: number; feedback: string } | null,
  logs: { time: string; text: string }[],
  evaluation?: CaseEvaluation | null,
): string {
  const lines: string[] = [];
  const ts = new Date().toLocaleString();

  lines.push(`# Clinical Simulation Report`);
  lines.push(`*Exported: ${ts}*`);
  lines.push('');

  // Patient
  lines.push(`## Patient`);
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Name | ${mc.patientName} |`);
  lines.push(`| Age | ${mc.age} |`);
  lines.push(`| Gender | ${mc.gender} |`);
  lines.push(`| Location | ${mc.currentLocation} |`);
  lines.push(`| Difficulty | ${mc.difficulty ?? '—'} |`);
  lines.push(`| Category | ${mc.category ?? '—'} |`);
  lines.push(`| Simulation Time | T+${mc.simulationTime} min |`);
  lines.push(`| Patient Outcome | ${mc.patientOutcome ?? 'alive'} |`);
  lines.push('');

  // Chief Complaint + HPI
  lines.push(`## Presentation`);
  lines.push(`**Chief Complaint:** ${mc.chiefComplaint}`);
  lines.push('');
  lines.push(mc.historyOfPresentIllness);
  lines.push('');

  if (mc.pastMedicalHistory?.length) {
    lines.push(`### Past Medical History`);
    mc.pastMedicalHistory.forEach(item => lines.push(`- ${item}`));
    lines.push('');
  }

  // Vitals
  lines.push(`## Vitals`);
  lines.push(`| Parameter | Value |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| Heart Rate | ${mc.vitals.heartRate} bpm |`);
  lines.push(`| Blood Pressure | ${mc.vitals.bloodPressure} mmHg |`);
  lines.push(`| Temperature | ${mc.vitals.temperature} °C |`);
  lines.push(`| Respiratory Rate | ${mc.vitals.respiratoryRate} /min |`);
  lines.push(`| SpO₂ | ${mc.vitals.oxygenSaturation}% |`);
  lines.push(`| Physiological Trend | ${mc.physiologicalTrend} |`);
  lines.push('');

  // Labs
  const orderedLabs = (mc.labs || []).filter(l => l.availableAt !== undefined);
  if (orderedLabs.length) {
    lines.push(`## Laboratory Results`);
    lines.push(`| Test | Value | Unit | Reference | Status |`);
    lines.push(`|------|-------|------|-----------|--------|`);
    orderedLabs.forEach(l => {
      lines.push(`| ${l.name} | ${l.value} | ${l.unit} | ${l.normalRange} | **${l.status}** |`);
    });
    lines.push('');
  }

  // Imaging
  const orderedImaging = (mc.imaging || []).filter(i => i.orderedAt !== undefined);
  if (orderedImaging.length) {
    lines.push(`## Imaging`);
    orderedImaging.forEach(img => {
      lines.push(`### ${img.type}`);
      if (img.technique)  lines.push(`**Technique:** ${img.technique}`);
      if (img.findings)   lines.push(`**Findings:** ${img.findings}`);
      if (img.impression) lines.push(`**Impression:** ${img.impression}`);
      lines.push('');
    });
  }

  // Medications
  if (mc.medications?.length) {
    lines.push(`## Medications Administered`);
    lines.push(`| Drug | Dose | Route | Time |`);
    lines.push(`|------|------|-------|------|`);
    mc.medications.forEach(m => {
      lines.push(`| ${m.name} | ${m.dose} | ${m.route} | T+${m.timestamp}m |`);
    });
    lines.push('');
  }

  // Timeline
  if (logs.length) {
    lines.push(`## Clinical Timeline`);
    logs.forEach(l => lines.push(`- \`${l.time}\` ${l.text}`));
    lines.push('');
  }

  // Clinical Actions
  if (mc.clinicalActions?.length) {
    lines.push(`## Action Audit`);
    mc.clinicalActions.forEach(a => {
      lines.push(`- **T+${a.timestamp}m** [${a.type}] ${a.description}${a.result ? ` → ${a.result}` : ''}`);
    });
    lines.push('');
  }

  // Diagnosis + Score
  lines.push(`## Outcome`);
  if (mc.correctDiagnosis) lines.push(`**Diagnosis:** ${mc.correctDiagnosis}`);
  if (mc.explanation)      lines.push(`**Explanation:** ${mc.explanation}`);
  lines.push('');

  if (feedback || evaluation) {
    lines.push(`## Performance`);
    const score = evaluation?.score ?? feedback?.score ?? 0;
    lines.push(`**Score:** ${score} / 100`);
    lines.push('');

    if (evaluation?.breakdown) {
      lines.push(`### Score Breakdown`);
      lines.push(`| Domain | Score | Max |`);
      lines.push(`|--------|-------|-----|`);
      lines.push(`| Initial Management | ${evaluation.breakdown.initialManagement} | 25 |`);
      lines.push(`| Diagnostic Workup | ${evaluation.breakdown.diagnosticWorkup} | 25 |`);
      lines.push(`| Therapeutic Interventions | ${evaluation.breakdown.therapeuticInterventions} | 30 |`);
      lines.push(`| Patient Outcome | ${evaluation.breakdown.patientOutcome} | 20 |`);
      if ((evaluation.breakdown.efficiencyPenalty ?? 0) < 0) {
        lines.push(`| Efficiency Penalty | ${evaluation.breakdown.efficiencyPenalty} | 0 |`);
      }
      lines.push('');
    }

    const feedbackText = evaluation?.feedback ?? feedback?.feedback ?? '';
    if (feedbackText) {
      lines.push(`### Feedback`);
      lines.push(`> ${feedbackText}`);
      lines.push('');
    }

    if (evaluation?.keyActions?.length) {
      lines.push(`### Key Actions`);
      evaluation.keyActions.forEach(a => lines.push(`- ${a}`));
      lines.push('');
    }

    if (evaluation?.criticalMissed?.length) {
      lines.push(`### Critical Missed / Delayed`);
      evaluation.criticalMissed.forEach(m => lines.push(`- ⚠ ${m}`));
      lines.push('');
    }

    if (evaluation?.clinicalPearl) {
      lines.push(`### Clinical Pearl`);
      lines.push(`> 💡 ${evaluation.clinicalPearl}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*Generated by OpenEHR Clinical Simulator*');
  return lines.join('\n');
}

// ── JSON export ───────────────────────────────────────────────────────────────
function generateJSON(
  mc: MedicalCase,
  feedback: { score: number; feedback: string } | null,
  logs: { time: string; text: string }[],
  evaluation?: CaseEvaluation | null,
) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    patient: {
      name: mc.patientName,
      age: mc.age,
      gender: mc.gender,
      location: mc.currentLocation,
      difficulty: mc.difficulty,
      category: mc.category,
    },
    presentation: {
      chiefComplaint: mc.chiefComplaint,
      historyOfPresentIllness: mc.historyOfPresentIllness,
      pastMedicalHistory: mc.pastMedicalHistory,
      initialAppearance: mc.initialAppearance,
    },
    vitals: mc.vitals,
    physiologicalTrend: mc.physiologicalTrend,
    patientOutcome: mc.patientOutcome,
    simulationTime: mc.simulationTime,
    labs: mc.labs,
    imaging: mc.imaging,
    medications: mc.medications,
    clinicalActions: mc.clinicalActions,
    timeline: logs,
    diagnosis: {
      correct: mc.correctDiagnosis,
      explanation: mc.explanation,
    },
    performance: evaluation ?? feedback ?? null,
  }, null, 2);
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CaseExport({ medicalCase, feedback, logs, evaluation }: CaseExportProps) {
  const [open, setOpen] = useState(false);

  if (!medicalCase) return null;

  const slug = medicalCase.patientName.replace(/\s+/g, '-').toLowerCase();
  const ts   = Date.now();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          'border-clinical-line bg-clinical-surface text-clinical-ink hover:bg-clinical-bg',
        )}
      >
        <Download className="h-3.5 w-3.5" />
        Export
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-[160] bg-clinical-surface border border-clinical-line rounded-lg shadow-xl min-w-[160px] overflow-hidden">
            <button
              onClick={() => {
                download(
                  generateMarkdown(medicalCase, feedback, logs, evaluation),
                  `case-${slug}-${ts}.md`,
                  'text/markdown',
                );
                setOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-clinical-ink hover:bg-clinical-bg transition-colors flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-clinical-slate/60" />
              Markdown (.md)
            </button>
            <button
              onClick={() => {
                download(
                  generateJSON(medicalCase, feedback, logs, evaluation),
                  `case-${slug}-${ts}.json`,
                  'application/json',
                );
                setOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-clinical-ink hover:bg-clinical-bg transition-colors flex items-center gap-2 border-t border-clinical-line/50"
            >
              <Download className="w-3.5 h-3.5 text-clinical-slate/60" />
              JSON (.json)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
