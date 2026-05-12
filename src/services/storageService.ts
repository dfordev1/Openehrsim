import { getSupabase } from '../lib/supabase';
import { MedicalCase } from '../types';

export async function saveSimulationResult(
  medicalCase: MedicalCase, 
  userDiagnosis: string, 
  score: number, 
  feedback: string
) {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase not configured. Result not saved.');
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase
    .from('simulation_results') as any)
    .insert([
      {
        user_id: user?.id || null,
        case_id: medicalCase.id,
        patient_name: medicalCase.patientName,
        age: medicalCase.age,
        category: medicalCase.category,
        difficulty: medicalCase.difficulty,
        user_diagnosis: userDiagnosis,
        correct_diagnosis: medicalCase.correctDiagnosis,
        score: score,
        feedback: feedback,
        simulation_time: medicalCase.simulationTime,
        clinical_actions: medicalCase.clinicalActions as any,
        medications: medicalCase.medications as any
      } as any
    ]);

  if (error) {
    console.error('Error saving to Supabase:', error);
    throw error;
  }
  return data;
}

export async function getRecentSimulations() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data, error } = await (supabase
    .from('simulation_results') as any)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Error fetching from Supabase:', error);
    return [];
  }
  return data;
}
