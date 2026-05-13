import { useState, useCallback } from 'react';
import type { MedicalCase } from '../types';
import { performIntervention, orderTest } from '../services/geminiService';
import type { UseClinicalReasoning } from './useClinicalReasoning';

interface Deps {
  medicalCase: MedicalCase | null;
  setMedicalCase: React.Dispatch<React.SetStateAction<MedicalCase | null>>;
  pushUndo: (label: string, snapshot: MedicalCase) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  reasoning: UseClinicalReasoning;
  setPatientOutcome: React.Dispatch<React.SetStateAction<'alive' | 'deceased' | 'critical_deterioration' | null>>;
  setLogs: React.Dispatch<React.SetStateAction<{ time: string; text: string }[]>>;
}

export function useInterventionHandlers({
  medicalCase,
  setMedicalCase,
  pushUndo,
  addToast,
  reasoning,
  setPatientOutcome,
  setLogs,
}: Deps) {
  const [intervening, setIntervening] = useState(false);
  const [interventionInput, setInterventionInput] = useState('');

  const handlePerformIntervention = useCallback(async (customWait?: number, directIntervention?: string) => {
    if (!medicalCase || intervening) return;
    const action = directIntervention || interventionInput || 'Observation';
    pushUndo(`Intervention: ${action}`, medicalCase);
    setIntervening(true);
    setLogs((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        text: directIntervention
          ? `ACTION: ${directIntervention}`
          : customWait
          ? `WAIT ${customWait} min`
          : `ORDER: ${interventionInput}`,
      },
    ]);
    try {
      const updated = await performIntervention(action, medicalCase, customWait || 5);
      setMedicalCase((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              labs: updated.labs || prev.labs,
              imaging: updated.imaging || prev.imaging,
              clinicalActions: updated.clinicalActions || prev.clinicalActions,
              vitals: { ...prev.vitals, ...(updated.vitals || {}) },
            }
          : updated
      );
      if (updated.patientOutcome && updated.patientOutcome !== 'alive') {
        setPatientOutcome(updated.patientOutcome);
        addToast(
          updated.patientOutcome === 'deceased'
            ? '⚠️ Patient has expired. Case concluded.'
            : '🔴 Critical deterioration — patient is unstable.',
          'error'
        );
      }
      setInterventionInput('');
      addToast(`Intervention executed: ${action}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Intervention failed';
      console.error('Intervention failed:', err);
      addToast(msg, 'error');
    } finally {
      setIntervening(false);
    }
  }, [medicalCase, intervening, interventionInput, pushUndo, addToast, setPatientOutcome, setMedicalCase, setLogs]);

  const handleOrderTest = useCallback(async (type: 'lab' | 'imaging', name: string) => {
    if (!medicalCase || intervening) return;
    setIntervening(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `ORDER: ${name}` }]);
    try {
      const result = await orderTest(medicalCase.id, type, name, medicalCase.simulationTime, 'stat');
      setMedicalCase((prev) => {
        if (!prev) return prev;
        return type === 'lab'
          ? { ...prev, labs: [...(prev.labs || []), result.testResult], clinicalActions: [...(prev.clinicalActions || []), result.action] }
          : { ...prev, imaging: [...(prev.imaging || []), result.testResult], clinicalActions: [...(prev.clinicalActions || []), result.action] };
      });
      reasoning.addFinding({
        source: type === 'lab' ? 'lab' : 'imaging',
        text: `${name} ordered (T+${medicalCase.simulationTime}m)`,
        relevance: 'none',
        addedAt: medicalCase.simulationTime,
      });
      addToast(result.message, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to order test', 'error');
    } finally {
      setIntervening(false);
    }
  }, [medicalCase, intervening, reasoning, addToast, setMedicalCase, setLogs]);

  const handleAdvanceTime = useCallback(async (minutes: number) => {
    if (!medicalCase || intervening) return;
    pushUndo(`Advance +${minutes}m`, medicalCase);
    setIntervening(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `ADVANCE TIME: +${minutes} min` }]);
    try {
      const updated = await performIntervention('', medicalCase, minutes);
      setMedicalCase((prev) => prev
        ? { ...prev, ...updated, labs: updated.labs ?? prev.labs, imaging: updated.imaging ?? prev.imaging, availableTests: prev.availableTests }
        : updated);
      if (updated.patientOutcome && updated.patientOutcome !== 'alive') {
        setPatientOutcome(updated.patientOutcome);
        addToast(updated.patientOutcome === 'deceased' ? '⚠️ Patient has expired.' : '🔴 Critical deterioration.', 'error');
      }
      addToast(`Clock → T+${updated.simulationTime} min`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to advance time', 'error');
    } finally {
      setIntervening(false);
    }
  }, [medicalCase, intervening, pushUndo, addToast, setPatientOutcome, setMedicalCase, setLogs]);

  return {
    intervening,
    interventionInput,
    setInterventionInput,
    handlePerformIntervention,
    handleOrderTest,
    handleAdvanceTime,
  };
}
