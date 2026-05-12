/**
 * Shared MEDICAL_CASE_SCHEMA string used in all AI prompts.
 * Single source of truth — import this instead of duplicating.
 * 
 * CCS-STYLE SIMULATION SCHEMA:
 * - Initial case has minimal info (vitals, chief complaint, appearance)
 * - Labs/imaging are ordered by user, have orderedAt/availableAt timestamps
 * - Physical exam findings revealed progressively (not all upfront)
 * - correctDiagnosis kept SERVER-SIDE ONLY for scoring (never sent to client)
 */
export const MEDICAL_CASE_SCHEMA = `
  interface MedicalCase {
    id: string;          // REQUIRED: a unique UUID or short alphanumeric id (e.g. "case-a1b2c3")
    patientName: string;
    age: number;
    gender: string;
    chiefComplaint: string;
    historyOfPresentIllness: string;  // Brief initial presentation only
    pastMedicalHistory: string[];
    vitals: {
      heartRate: number;
      bloodPressure: string;
      temperature: number;
      respiratoryRate: number;
      oxygenSaturation: number;
    };
    initialAppearance: string;  // What you see when patient arrives (e.g., "diaphoretic, clutching chest")
    physicalExam: {
      heent: string;
      cardiac: string;
      respiratory: string;
      abdomen: string;
      extremities: string;
      neurological: string;
      examined?: boolean;  // Whether this system has been examined yet
    };
    labs: {
      name: string;
      value: string | number;
      unit: string;
      normalRange: string;
      status: 'normal' | 'abnormal' | 'critical';
      orderedAt?: number;      // Simulation time when ordered
      availableAt?: number;    // Simulation time when results ready
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
    availableTests: {      // Catalog of orderable tests for this case
      labs: string[];      // e.g., ["CBC", "BMP", "Troponin", "Lactate", "Blood Culture"]
      imaging: string[];   // e.g., ["Chest X-ray", "CT Head", "ECG"]
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
      timestamp: number;     // Changed to number for easier comparison
      type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication' | 'time-advance';
      description: string;
      result?: string;
      impact?: string;
    }[];
    patientOutcome?: 'alive' | 'deceased' | 'critical_deterioration';
    
    // SERVER-SIDE ONLY FIELDS (not sent to client during active case):
    correctDiagnosis?: string;      // Hidden until case ends
    explanation?: string;           // Hidden until case ends
    underlyingPathology?: string;   // Hidden - used by AI to evolve patient realistically
  }
`;
