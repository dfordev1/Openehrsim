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
    historyOfPresentIllness: string;   // 4-6 sentences: onset, character, severity, radiation, aggravating/relieving, 2 associated symptoms
    pastMedicalHistory: string[];      // 2-4 comorbidities with durations, each relevant to management
    initialAppearance: string;         // Vivid 2-sentence bedside impression: affect, skin, breathing, posture
    vitals: {
      heartRate: number;
      bloodPressure: string;           // e.g. "118/76"
      temperature: number;             // °C
      respiratoryRate: number;
      oxygenSaturation: number;        // %
    };
    physicalExam: {
      heent: string;     // 2-3 sentences — subtle findings matter
      cardiac: string;   // 2-3 sentences
      respiratory: string; // 2-3 sentences
      abdomen: string;   // 2-3 sentences
      extremities: string; // 2-3 sentences
      neurological: string; // 2-3 sentences
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
      findings?: string;              // multi-sentence detailed findings
      impression?: string;
      orderedAt?: number;
      availableAt?: number;
    }[];
    availableTests: {                  // Comprehensive catalog — ≥30 labs, ≥15 imaging
      labs: string[];
      imaging: string[];
    };
    priorRecords: {
      homeMedications: {
        name: string;
        dose: string;
        route: string;
        indication: string;
      }[];
      allergies: {
        agent: string;
        reaction: string;
        severity: 'mild' | 'moderate' | 'severe';
      }[];
      baselineLabs: {              // Labs from 3-6 months ago showing pre-illness baseline
        name: string;
        value: string;
        unit: string;
        collectedDaysAgo: number;
      }[];
      priorHospitalizations: {
        reason: string;
        daysAgo: number;
        outcome: string;
      }[];
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
    category: string;                  // primary specialty category
    specialty_tags: string[];          // ALL specialties involved — min 2
    managementConflicts: string[];     // explicit competing treatment priorities
    requiredConsultations: string[];   // specialties that MUST be consulted for correct management
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
    correctDiagnosis?: string;         // primary + secondary diagnosis
    explanation?: string;              // 4-5 sentence teaching point
    underlyingPathology?: string;      // 6-8 sentence full pathophysiological cascade
  }
`;
