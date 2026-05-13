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
    availableTests: {
      // Each entry carries its OWN realistic turnaround times — no hard-coded lookup table.
      // stat/routine are in sim-minutes. Use clinical knowledge: POC=2-5, standard=15-30,
      // send-out/culture/specialized=hours to days. Examples:
      //   {name:"Blood Glucose (POC)", stat:2, routine:5}
      //   {name:"CBC", stat:15, routine:45}
      //   {name:"ADAMTS13 Activity", stat:1440, routine:4320}
      //   {name:"Blood Culture x2", stat:2880, routine:4320}
      labs: { name: string; stat: number; routine: number }[];
      imaging: { name: string; stat: number; routine: number }[];
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
