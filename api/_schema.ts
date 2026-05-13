/**
 * Shared MEDICAL_CASE_SCHEMA string used in all AI prompts.
 * Single source of truth — import this instead of duplicating.
 *
 * NOTE: This MUST stay in sync with src/lib/schema.ts and src/types.ts.
 */
export const MEDICAL_CASE_SCHEMA = `
  interface MedicalCase {
    id: string;          // REQUIRED: a unique UUID or short alphanumeric id (e.g. "case-a1b2c3")
    patientName: string;
    age: number;
    gender: string;
    chiefComplaint: string;
    historyOfPresentIllness: string;
    pastMedicalHistory: string[];
    initialAppearance: string;         // Vivid 1-sentence bedside impression
    vitals: {
      heartRate: number;
      bloodPressure: string;
      temperature: number;
      respiratoryRate: number;
      oxygenSaturation: number;
    };
    physicalExam: {
      heent: string;
      cardiac: string;
      respiratory: string;
      abdomen: string;
      extremities: string;
      neurological: string;
    };
    labs: {
      name: string;
      value: string | number;
      unit: string;
      normalRange: string;
      status: 'normal' | 'abnormal' | 'critical';
      orderedAt?: number;
      availableAt?: number;
      clinicalNote?: string;
    }[];
    imaging: {
      type: string;
      technique?: string;
      findings?: string;
      impression?: string;
      orderedAt?: number;
      availableAt?: number;
    }[];
    availableTests: {
      // Each entry declares its OWN turnaround times — no hard-coded lookup table needed.
      // stat/routine in sim-minutes. Use real clinical knowledge for each specific test.
      labs: { name: string; stat: number; routine: number }[];
      imaging: { name: string; stat: number; routine: number }[];
    };
    medications: {
      id: string;
      name: string;
      dose: string;
      route: string;
      timestamp: number;
      isIVFluid?: boolean;   // true for NS, LR, albumin, etc.
      volumeML?: number;     // volume in mL for fluid balance tracking
    }[];
    activeAlarms: string[];
    correctDiagnosis: string;
    explanation: string;
    currentCondition: string;
    physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical';
    simulationTime: number;
    currentLocation: string;
    difficulty: 'intern' | 'resident' | 'attending';
    category: 'cardiology' | 'pulmonology' | 'sepsis' | 'trauma' | 'neurology' | 'toxicology';
    communicationLog: {
      id: string;
      timestamp: number;
      from: string;
      to: string;
      message: string;
      type: 'call' | 'text' | 'consult';
    }[];
    clinicalActions: {
      id: string;
      timestamp: number;               // sim-minutes (number, not string)
      type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication' | 'time-advance';
      description: string;
      result?: string;
      impact?: string;
    }[];
    patientOutcome?: 'alive' | 'deceased' | 'critical_deterioration';
  }
`;
