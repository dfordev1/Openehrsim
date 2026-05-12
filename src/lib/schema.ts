/**
 * Shared MEDICAL_CASE_SCHEMA string used in all AI prompts.
 * Single source of truth — import this instead of duplicating.
 *
 * CCS-STYLE: correctDiagnosis / explanation / underlyingPathology are
 * server-side only and must NEVER be sent to the client during an active case.
 */
export const MEDICAL_CASE_SCHEMA = `
  interface MedicalCase {
    id: string;                  // REQUIRED unique id e.g. "case-a1b2c3"
    patientName: string;
    age: number;
    gender: string;
    chiefComplaint: string;
    historyOfPresentIllness: string;   // Brief — 2-3 sentences max
    pastMedicalHistory: string[];
    initialAppearance: string;         // Vivid 1-sentence bedside impression
    vitals: {
      heartRate: number;
      bloodPressure: string;           // e.g. "118/76"
      temperature: number;             // °C
      respiratoryRate: number;
      oxygenSaturation: number;        // %
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
      orderedAt?: number;              // sim-minutes when ordered
      availableAt?: number;            // sim-minutes when result ready
      clinicalNote?: string;           // pathologist / tech comment
    }[];
    imaging: {
      type: string;
      technique?: string;
      findings?: string;
      impression?: string;
      orderedAt?: number;
      availableAt?: number;
    }[];
    availableTests: {                  // Catalog the user can order from
      labs: string[];
      imaging: string[];
    };
    medications: {
      id: string;
      name: string;
      dose: string;
      route: string;
      timestamp: number;
      isIVFluid?: boolean;
      volumeML?: number;
    }[];
    activeAlarms: string[];
    currentCondition: string;
    physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical';
    simulationTime: number;            // minutes elapsed
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
      timestamp: number;
      type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication' | 'time-advance';
      description: string;
      result?: string;
      impact?: string;
    }[];
    patientOutcome?: 'alive' | 'deceased' | 'critical_deterioration';

    // SERVER-SIDE ONLY — never send to client during active case
    correctDiagnosis?: string;
    explanation?: string;
    underlyingPathology?: string;
  }
`;
