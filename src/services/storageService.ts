import { getSupabase } from '../lib/supabase';
import { MedicalCase } from '../types';

export interface SimulationRecord {
  id?: string;
  user_id: string | null;
  case_id: string;
  patient_name: string;
  age: number;
  category?: string;
  difficulty?: string;
  user_diagnosis: string;
  correct_diagnosis: string;
  score: number;
  feedback: string;
  simulation_time: number;
  clinical_actions: unknown;
  medications: unknown;
  created_at?: string;
}

export async function saveSimulationResult(
  medicalCase: MedicalCase, 
  userDiagnosis: string, 
  score: number, 
  feedback: string
): Promise<SimulationRecord[] | null> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase not configured. Result not saved.');
    return null;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user. Result not saved.');
      return null;
    }

    const { data, error } = await (supabase
      .from('simulation_results') as any)
      .insert([
        {
          user_id: user.id,
          case_id: medicalCase.id,
          patient_name: medicalCase.patientName,
          age: medicalCase.age,
          category: medicalCase.category || null,
          difficulty: medicalCase.difficulty || null,
          user_diagnosis: userDiagnosis,
          correct_diagnosis: medicalCase.correctDiagnosis,
          score,
          feedback,
          simulation_time: medicalCase.simulationTime,
          clinical_actions: medicalCase.clinicalActions,
          medications: medicalCase.medications,
        }
      ]);

    if (error) {
      console.error('Error saving to Supabase:', error.message);
      throw new Error(`Failed to save simulation: ${error.message}`);
    }
    return data;
  } catch (err) {
    console.error('Storage service error:', err instanceof Error ? err.message : err);
    throw err;
  }
}

export async function getRecentSimulations(): Promise<SimulationRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await (supabase
      .from('simulation_results') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      console.error('Error fetching from Supabase:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('Storage service fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}
