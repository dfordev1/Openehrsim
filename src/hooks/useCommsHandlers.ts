import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MedicalCase, ConsultantAdvice } from '../types';
import { staffCall, performIntervention } from '../services/geminiService';
import { getConsultantAdvice } from '../services/aiConsultantService';

interface Deps {
  medicalCase: MedicalCase | null;
  setMedicalCase: Dispatch<SetStateAction<MedicalCase | null>>;
  pushUndo: (label: string, snapshot: MedicalCase) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  setLogs: Dispatch<SetStateAction<{ time: string; text: string }[]>>;
}

export function useCommsHandlers({ medicalCase, setMedicalCase, pushUndo, addToast, setLogs }: Deps) {
  const [callTarget, setCallTarget] = useState('Nursing Station');
  const [callMessage, setCallMessage] = useState('');
  const [calling, setCalling] = useState(false);
  const [consultantAdvice, setConsultantAdvice] = useState<ConsultantAdvice | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);
  const [isConsultOpen, setIsConsultOpen] = useState(false);

  const handleStaffCall = useCallback(async () => {
    if (!medicalCase || !callMessage) return;
    pushUndo(`Call: ${callTarget}`, medicalCase);
    setCalling(true);
    try {
      const { reply, updatedCase } = await staffCall(callTarget, callMessage, medicalCase);
      setMedicalCase(updatedCase);
      setCallMessage('');
      setLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), text: `COMM: Call to ${callTarget} - "${reply.slice(0, 30)}..."` },
      ]);
      addToast(`Staff call to ${callTarget} completed`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Staff call failed', 'error');
      console.error(err);
    } finally {
      setCalling(false);
    }
  }, [medicalCase, callMessage, callTarget, pushUndo, addToast, setMedicalCase, setLogs]);

  const handleConsult = useCallback(async () => {
    if (!medicalCase) return;
    setIsConsulting(true);
    setIsConsultOpen(true);
    try {
      // Both calls read medicalCase independently — run in parallel
      const [advice, updated] = await Promise.all([
        getConsultantAdvice(medicalCase),
        performIntervention('Requested Specialty Consultation', medicalCase, 10),
      ]);
      setConsultantAdvice(advice);
      setMedicalCase(updated);
      setLogs((prev) => [
        ...prev,
        { time: `T + ${updated.simulationTime}`, text: 'Expert Consultation requested (+10 min)' },
      ]);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Consultant is currently unavailable.', 'error');
      console.error(err);
    } finally {
      setIsConsulting(false);
    }
  }, [medicalCase, addToast, setMedicalCase, setLogs]);

  return {
    callTarget,
    setCallTarget,
    callMessage,
    setCallMessage,
    calling,
    consultantAdvice,
    isConsulting,
    isConsultOpen,
    setIsConsultOpen,
    handleStaffCall,
    handleConsult,
  };
}
