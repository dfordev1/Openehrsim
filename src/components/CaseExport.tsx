import { Download } from 'lucide-react';
import { cn } from '../lib/utils';
import type { MedicalCase } from '../types';

interface CaseExportProps {
  medicalCase: MedicalCase | null;
  feedback: { score: number; feedback: string } | null;
  logs: { time: string; text: string }[];
}

function generateMarkdown(
  medicalCase: MedicalCase,
  feedback: { score: number; feedback: string } | null,
  logs: { time: string; text: string }[]
): string {
  const lines: string[] = [];

  lines.push(`# Clinical Simulation Report`);
  lines.push('');

  // Patient Info
  lines.push(`## Patient Information`);
  lines.push(`- **Name:** ${medicalCase.patientName}`);
  lines.push(`- **Age:** ${medicalCase.age}`);
  lines.push(`- **Gender:** ${medicalCase.gender}`);
  lines.push(`- **Location:** ${medicalCase.currentLocation}`);
  lines.push('');

  // Chief Complaint
  lines.push(`## Chief Complaint`);
  lines.push(medicalCase.chiefComplaint);
  lines.push('');

  // HPI
  lines.push(`## History of Present Illness`);
  lines.push(medicalCase.historyOfPresentIllness);
  lines.push('');

  // Past Medical History
  if (medicalCase.pastMedicalHistory.length > 0) {
    lines.push(`## Past Medical History`);
    medicalCase.pastMedicalHistory.forEach((item) => {
      lines.push(`- ${item}`);
    });
    lines.push('');
  }

  // Vitals
  lines.push(`## Vitals`);
  lines.push(`| Parameter | Value |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| Heart Rate | ${medicalCase.vitals.heartRate} bpm |`);
  lines.push(`| Blood Pressure | ${medicalCase.vitals.bloodPressure} |`);
  lines.push(`| Temperature | ${medicalCase.vitals.temperature} °C |`);
  lines.push(`| Respiratory Rate | ${medicalCase.vitals.respiratoryRate} /min |`);
  lines.push(`| SpO2 | ${medicalCase.vitals.oxygenSaturation}% |`);
  lines.push('');

  // Labs
  const availableLabs = medicalCase.labs.filter((lab) => lab.availableAt !== undefined);
  if (availableLabs.length > 0) {
    lines.push(`## Laboratory Results`);
    lines.push(`| Test | Value | Unit | Range | Status |`);
    lines.push(`|------|-------|------|-------|--------|`);
    availableLabs.forEach((lab) => {
      lines.push(`| ${lab.name} | ${lab.value} | ${lab.unit} | ${lab.normalRange} | ${lab.status} |`);
    });
    lines.push('');
  }

  // Imaging
  if (medicalCase.imaging.length > 0) {
    lines.push(`## Imaging`);
    medicalCase.imaging.forEach((img) => {
      lines.push(`### ${img.type}`);
      if (img.technique) lines.push(`- **Technique:** ${img.technique}`);
      if (img.findings) lines.push(`- **Findings:** ${img.findings}`);
      if (img.impression) lines.push(`- **Impression:** ${img.impression}`);
      lines.push('');
    });
  }

  // Clinical Actions Timeline
  if (logs.length > 0) {
    lines.push(`## Clinical Actions Timeline`);
    logs.forEach((log) => {
      lines.push(`- **[${log.time}]** ${log.text}`);
    });
    lines.push('');
  }

  // Diagnosis & Score
  lines.push(`## Diagnosis`);
  lines.push(`- **Correct Diagnosis:** ${medicalCase.correctDiagnosis}`);
  lines.push(`- **Explanation:** ${medicalCase.explanation}`);
  lines.push('');

  if (feedback) {
    lines.push(`## Performance Score`);
    lines.push(`- **Score:** ${feedback.score}/100`);
    lines.push(`- **Feedback:** ${feedback.feedback}`);
    lines.push('');
  }

  return lines.join('\n');
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CaseExport({ medicalCase, feedback, logs }: CaseExportProps) {
  const handleExport = () => {
    if (!medicalCase) return;

    const markdown = generateMarkdown(medicalCase, feedback, logs);
    const filename = `case-${medicalCase.patientName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;
    downloadMarkdown(markdown, filename);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!medicalCase}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        'border-clinical-line bg-clinical-surface text-clinical-ink',
        'hover:bg-clinical-line/50',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      <Download className="h-3.5 w-3.5" />
      Export
    </button>
  );
}
