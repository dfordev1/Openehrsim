import { getSupabase } from '../lib/supabase';
import { MedicalCase, CaseEvaluation } from '../types';

/** Client-side fallback save. The server-side /api/end-case already persists
 *  the result; this only runs if Supabase is configured and the server insert
 *  failed (e.g. missing reasoning columns on an unmigrated schema). */
export async function saveCCSResult(
  medicalCase: MedicalCase,
  evaluation: CaseEvaluation
) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase.from('simulation_results') as any).insert([{
    user_id:              user?.id ?? null,
    case_id:              medicalCase.id,
    patient_name:         medicalCase.patientName,
    age:                  medicalCase.age,
    category:             medicalCase.category,
    difficulty:           medicalCase.difficulty,
    user_diagnosis:       null,
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
    .select('case_id, patient_name, age, category, difficulty, score, correct_diagnosis, feedback, reasoning_score, created_at')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching simulations:', error);
    return [];
  }
  return data ?? [];
}
