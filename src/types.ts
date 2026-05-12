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
  orderedAt?: number;
  availableAt?: number;
  clinicalNote?: string; // Pathologist/Tech notes
}

export interface ImagingResult {
  type: string;
  technique?: string;
  findings?: string;
  impression?: string;
  orderedAt?: number;
  availableAt?: number;
}

export interface Treatment {
  name: string;
  category: 'medication' | 'procedure' | 'fluid' | 'respiratory';
  dose?: string;
  route?: string;
}

export interface ClinicalAction {
  id: string;
  timestamp: string; // Simulation time minute
  type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication';
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
  isIVFluid?: boolean;  // true for NS, LR, albumin, colloids, etc.
  volumeML?: number;    // mL administered — used for fluid balance tracking
}

export interface MedicalCase {
  id: string;
  patientName: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string[];
  vitals: Vitals;
  physicalExam: PhysicalExam;
  labs: LabResult[];
  imaging: ImagingResult[];
  medications: MedicationRecord[];
  activeAlarms: string[];
  correctDiagnosis: string;
  explanation: string;
  currentCondition: string;
  physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical';
  clinicalActions: ClinicalAction[];
  simulationTime: number;
  currentLocation: string; // e.g. "ER Bay 3", "ICU Bed 4", "Cath Lab"
  communicationLog: CommunicationMessage[];
  difficulty?: 'intern' | 'resident' | 'attending';
  category?: 'cardiology' | 'pulmonology' | 'sepsis' | 'trauma' | 'neurology' | 'toxicology';
  patientOutcome?: 'alive' | 'deceased' | 'critical_deterioration';
}

export interface ConsultantAdvice {
  advice: string;
  reasoning: string;
  recommendedActions: string[];
}
