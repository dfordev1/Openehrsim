export interface Vitals {
  heartRate: number;
  bloodPressure: string;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
}

export interface PhysicalExam {
  heent: string;
  cardiac: string;
  respiratory: string;
  abdomen: string;
  extremities: string;
  neurological: string;
}

export interface LabResult {
  name: string;
  value: string | number;
  unit: string;
  normalRange: string;
  status: 'normal' | 'abnormal' | 'critical';
  orderedAt?: number;    // sim-minutes when ordered
  availableAt?: number;  // sim-minutes when result ready
  clinicalNote?: string;
}

export interface ImagingResult {
  type: string;
  technique?: string;
  findings?: string;
  impression?: string;
  orderedAt?: number;
  availableAt?: number;
}

export interface AvailableTest {
  name: string;
  stat: number;
  routine: number;
}

export interface AvailableTests {
  labs: AvailableTest[];
  imaging: AvailableTest[];
}

export interface AvailableMedication {
  name: string;      // includes dose, e.g. "Metoprolol tartrate 25mg"
  route: string;     // "Oral" | "Intravenous" | "Subcutaneous" etc.
  frequency: string; // "Once" | "Daily" | "BID" | "Continuous" | "PRN" etc.
  category: string;  // "Antihypertensive" | "Antibiotic" etc.
}

export interface OrderSearchResult {
  name: string;
  category: 'lab' | 'imaging' | 'medication';
  route?: string;
  frequency?: string;
  stat?: number;
  routine?: number;
}

export interface ClinicalAction {
  id: string;
  timestamp: number; // sim-minutes (number, not string)
  type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication' | 'time-advance';
  description: string;
  result?: string;
  impact?: string;
}

export interface CommunicationMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  message: string;
  type: 'call' | 'text' | 'consult';
}

export interface MedicationRecord {
  id: string;
  name: string;
  dose: string;
  route: string;
  timestamp: number;
  isIVFluid?: boolean;
  volumeML?: number;
}

export interface MedicalCase {
  id: string;
  patientName: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string[];
  initialAppearance?: string;       // CCS: vivid first impression
  vitals: Vitals;
  physicalExam: PhysicalExam;
  labs: LabResult[];
  imaging: ImagingResult[];
  availableTests?: AvailableTests;
  availableMedications?: AvailableMedication[];
  medications: MedicationRecord[];
  activeAlarms: string[];
  currentCondition: string;
  physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical';
  clinicalActions: ClinicalAction[];
  simulationTime: number;
  currentLocation: string;
  communicationLog: CommunicationMessage[];
  specialty_tags?: string[];
  managementConflicts?: string[];
  requiredConsultations?: string[];
  difficulty?: 'intern' | 'resident' | 'attending';
  category?:
    // Cardiovascular & Respiratory
    | 'cardiology' | 'pulmonology' | 'vascular_surgery' | 'cardiothoracic'
    // Neurosciences
    | 'neurology' | 'neurosurgery' | 'psychiatry' | 'pain_medicine'
    // Internal Medicine
    | 'gastroenterology' | 'gi_hepatology' | 'nephrology' | 'endocrinology'
    | 'hematology_oncology' | 'rheumatology' | 'allergy_immunology'
    | 'dermatology' | 'geriatrics'
    // Infectious & Critical
    | 'infectious_disease' | 'sepsis' | 'toxicology' | 'critical_care'
    // Surgery & Trauma
    | 'trauma' | 'orthopaedics' | 'urology' | 'sports_medicine'
    // Sensory & Head/Neck
    | 'ophthalmology' | 'ent'
    // Women, Children & Lifecycle
    | 'obgyn' | 'pediatrics' | 'neonatology' | 'palliative_care';
  patientOutcome?: 'alive' | 'deceased' | 'critical_deterioration';

  // Server-side only — will be undefined on the client during an active case
  correctDiagnosis?: string;
  explanation?: string;
}

export interface ConsultantAdvice {
  advice: string;
  reasoning: string;
  recommendedActions: string[];
}

/** Returned by /api/end-case */
export interface CaseEvaluation {
  score: number;
  breakdown: {
    initialManagement: number;
    diagnosticWorkup: number;
    therapeuticInterventions: number;
    patientOutcome: number;
    efficiencyPenalty: number;
  };
  reasoningScore?: ReasoningScore;
  feedback: string;
  correctDiagnosis: string;
  explanation: string;
  keyActions: string[];
  criticalMissed: string[];
  clinicalPearl: string;
  caseId: string;
  totalSimulationTime: number;
  savedToDb?: boolean;
}

// ── Healer-style Clinical Reasoning Types ─────────────────────────────────────

/** A clinical finding tracked in the Diagnosis Pad.
 *  `relevance` is kept for backward-compatibility (it represents the
 *  finding's *overall* pertinence when no per-differential assignment has
 *  been made). When differentials exist, prefer `relevanceByDx`, which
 *  records whether the finding is a pertinent positive/negative for each
 *  differential entry by id. */
export interface ClinicalFinding {
  id: string;
  source: 'history' | 'exam' | 'lab' | 'imaging' | 'vitals';
  text: string;
  relevance: 'positive' | 'negative' | 'none';
  relevanceByDx?: Record<string, 'positive' | 'negative' | 'none'>;
  addedAt: number; // sim-minutes
}

/** Structured disease knowledge attached to a differential entry.
 *  Healer calls this an "illness script" — the learner writes down
 *  what they would *expect* for this diagnosis so they can compare it
 *  against the findings gathered. */
export interface IllnessScript {
  typicalDemographics?: string;
  typicalTimeline?: string;
  keyFeatures: string[];          // classic findings you'd expect to see
  discriminatingFeatures: string[]; // findings that distinguish from others
  expectedLabs: string[];         // labs/imaging you'd expect to be abnormal
}

/** A differential diagnosis entry */
export interface DifferentialEntry {
  id: string;
  diagnosis: string;
  confidence: 'high' | 'moderate' | 'low';
  addedAt: number; // sim-minutes
  isLead?: boolean;
  illnessScript?: IllnessScript;
}

/** A snapshot of the Problem Representation at a specific stage.
 *  Healer scores how the PR evolves across stages as data accrues. */
export interface PRSnapshot {
  id: string;
  stage: WorkflowStage;
  text: string;
  simTime: number;
  createdAt: number; // wall-clock ms for ordering
}

/** Recorded when a learner commits their reasoning at a stage gate
 *  before advancing to the next stage. */
export interface StageCommitment {
  stage: WorkflowStage;
  prSnapshotId: string;
  committedDifferentialIds: string[];
  leadDiagnosisId?: string;
  committedAt: number;  // wall-clock ms
  simTime: number;
}

/** Real-time formative feedback surfaced while the case is active. */
export interface ReasoningNudge {
  id: string;
  type:
    | 'pr-stale'                  // PR not updated since last stage
    | 'ddx-too-narrow'            // too few differentials for current stage
    | 'ddx-too-broad'             // too many at a late stage
    | 'lead-not-committed'        // no lead in a stage that requires one
    | 'findings-unassigned'       // findings exist but no +/- against dxs
    | 'tests-without-ddx'         // labs ordered but DDx still empty
    | 'illness-script-missing';   // lead Dx has no script written
  severity: 'info' | 'warning';
  message: string;
  stage: WorkflowStage;
}

/** Clinical reasoning workflow stages (Healer-style) */
export type WorkflowStage = 'triage' | 'history' | 'exam' | 'diagnostics' | 'dxpause' | 'management';

/** Minimum requirements to pass a stage commit gate. */
export interface StageRequirements {
  minPrLength: number;        // characters in problem representation
  minDifferentials: number;   // how many DDx entries must exist
  requiresLead: boolean;      // must a lead be committed?
  requiresFindingsLinked?: boolean; // at least 1 finding linked to a dx
}

/** Enhanced scoring with clinical reasoning axes */
export interface ReasoningScore {
  dataAcquisitionThoroughness: number; // 0-100
  dataAcquisitionEfficiency: number;   // 0-100
  problemRepresentation: number;       // 0-100
  differentialAccuracy: number;        // 0-100
  finalLeadDiagnosis: number;          // 0-100
  managementPlan: number;              // 0-100
  overall: number;                     // 0-100
}
