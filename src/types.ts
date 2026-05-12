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

export interface AvailableTests {
  labs: string[];
  imaging: string[];
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
  availableTests?: AvailableTests;  // CCS: catalog of orderable tests
  medications: MedicationRecord[];
  activeAlarms: string[];
  currentCondition: string;
  physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical';
  clinicalActions: ClinicalAction[];
  simulationTime: number;
  currentLocation: string;
  communicationLog: CommunicationMessage[];
  difficulty?: 'intern' | 'resident' | 'attending';
  category?: 'cardiology' | 'pulmonology' | 'sepsis' | 'trauma' | 'neurology' | 'toxicology';
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
  feedback: string;
  correctDiagnosis: string;
  explanation: string;
  keyActions: string[];
  criticalMissed: string[];
  clinicalPearl: string;
  caseId: string;
  totalSimulationTime: number;
}
