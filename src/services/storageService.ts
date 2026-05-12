import { getSupabase } from '../lib/supabase';
import { MedicalCase, CaseEvaluation } from '../types';

export async function saveSimulationResult(
  medicalCase: MedicalCase,
  userDiagnosis: string,
  score: number,
  feedback: string
) {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase not configured — result not saved.');
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from('simulation_results') as any).insert([{
    user_id:           user?.id || null,
    case_id:           medicalCase.id,
    patient_name:      medicalCase.patientName,
    age:               medicalCase.age,
    category:          medicalCase.category,
    difficulty:        medicalCase.difficulty,
    user_diagnosis:    userDiagnosis,
    correct_diagnosis: medicalCase.correctDiagnosis,
    score,
    feedback,
    simulation_time:   medicalCase.simulationTime,
    clinical_actions:  medicalCase.clinicalActions as any,
    medications:       medicalCase.medications     as any,
  } as any]);

  if (error) console.error('Error saving to Supabase:', error);
  return data;
}

/** Save a full CCS evaluation (richer than the basic saveSimulationResult). */
export async function saveCCSResult(
  medicalCase: MedicalCase,
  evaluation: CaseEvaluation
) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from('simulation_results') as any).insert([{
    user_id:              user?.id || null,
    case_id:              medicalCase.id,
    patient_name:         medicalCase.patientName,
    age:                  medicalCase.age,
    category:             medicalCase.category,
    difficulty:           medicalCase.difficulty,
    user_diagnosis:       null,                        // CCS scores management, not diagnosis guess
    correct_diagnosis:    evaluation.correctDiagnosis,
    score:                evaluation.score,
    feedback:             evaluation.feedback,
    simulation_time:      evaluation.totalSimulationTime,
    clinical_actions:     medicalCase.clinicalActions as any,
    medications:          medicalCase.medications     as any,
    management_breakdown: evaluation.breakdown        as any,
    key_actions:          evaluation.keyActions       as any,
    clinical_pearl:       evaluation.clinicalPearl,
  } as any]);

  if (error) console.error('Error saving CCS result:', error);
  return data;
}

export async function getRecentSimulations() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase.from('simulation_results') as any)
    .select('category, difficulty, score, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Error fetching simulations:', error);
    return [];
  }
  return data ?? [];
}
