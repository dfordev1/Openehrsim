/**
 * ClinicalLayout — static HTML aesthetic. No Tailwind. No animations.
 * Plain text, inline styles for layout only, browser-native controls.
 */

import * as Sentry from '@sentry/react';
import React, {
  Component,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCase } from '../contexts/CaseContext';
import { useNavigation } from '../contexts/NavigationContext';
import { AuthModal } from './Auth';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import { AssessmentTab } from './tabs/AssessmentTab';
import { ArchiveView } from './ArchiveView';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import type { LabResult, ImagingResult, ClinicalAction, MedicationRecord, MedicalCase } from '../types';

// ── Error boundary ─────────────────────────────────────────────────────────────
interface EBProps { children: ReactNode }
interface EBState { hasError: boolean }

class ErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI Crash:', error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, maxWidth: 500, margin: '0 auto' }}>
          <p><strong>Something went wrong</strong></p>
          <p>The simulator encountered an error.</p>
          <button onClick={() => window.location.reload()}>Restart</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };

// ── Main export ────────────────────────────────────────────────────────────────
export function ClinicalLayout() {
  return (
    <ErrorBoundary>
      <ClinicalShell />
    </ErrorBoundary>
  );
}

// ── Stream types ───────────────────────────────────────────────────────────────
type StreamItem =
  | { kind: 'divider'; time: number; id: string }
  | { kind: 'action'; id: string; time: number; text: string; impact?: string }
  | { kind: 'lab'; id: string; lab: LabResult }
  | { kind: 'imaging'; id: string; img: ImagingResult }
  | { kind: 'pending'; id: string; name: string; availableAt: number };

function buildStream(mc: MedicalCase, simTime: number): StreamItem[] {
  const items: StreamItem[] = [];
  const timestamps = new Set<number>();

  const actions = (mc.clinicalActions || []).filter(
    a => a.type !== 'time-advance'
  );
  for (const a of actions) timestamps.add(a.timestamp);
  for (const l of mc.labs || []) if (l.availableAt !== undefined && l.availableAt <= simTime) timestamps.add(l.availableAt);
  for (const i of mc.imaging || []) if (i.availableAt !== undefined && i.availableAt <= simTime) timestamps.add(i.availableAt);

  const sorted = Array.from(timestamps).sort((a, b) => a - b);

  for (const t of sorted) {
    items.push({ kind: 'divider', time: t, id: `div-${t}` });

    for (const a of actions.filter(x => x.timestamp === t)) {
      items.push({
        kind: 'action',
        id: a.id,
        time: t,
        text: a.description,
        impact: a.impact,
      });
    }
    for (const l of (mc.labs || []).filter(x => x.availableAt === t && x.availableAt <= simTime)) {
      items.push({ kind: 'lab', id: `lab-${l.name}-${t}`, lab: l });
    }
    for (const img of (mc.imaging || []).filter(x => x.availableAt === t && x.availableAt <= simTime)) {
      items.push({ kind: 'imaging', id: `img-${img.type}-${t}`, img });
    }
  }

  // Pending tests
  for (const l of (mc.labs || []).filter(x => x.availableAt !== undefined && x.availableAt > simTime)) {
    items.push({ kind: 'pending', id: `pend-lab-${l.name}`, name: l.name, availableAt: l.availableAt! });
  }
  for (const img of (mc.imaging || []).filter(x => x.availableAt !== undefined && x.availableAt > simTime)) {
    items.push({ kind: 'pending', id: `pend-img-${img.type}`, name: img.type, availableAt: img.availableAt! });
  }

  return items;
}

// ── Shell ──────────────────────────────────────────────────────────────────────
function ClinicalShell() {
  const {
    user, isAuthOpen, setIsAuthOpen, handleLogout,
    isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery,
  } = useAuth();

  const {
    medicalCase, loading, error, loadingStep, patientOutcome,
    consultantAdvice, isConsulting, isConsultOpen, setIsConsultOpen,
    intervening, userNotes, setUserNotes, evaluation, submitting,
    differential, setDifferential, calling, logs, reasoning,
    isDxPadOpen, setIsDxPadOpen, dxPadInitialTab,
    pendingStage, setPendingStage,
    loadNewCase, handlePerformIntervention, handleConsult,
    handleOrderTest, handleOrderMedication, handleDiscontinueMedication,
    handleAdvanceTime, handleEndCase, handleStageNavigate, setMedicalCase, simTime,
  } = useCase();

  const { isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen } = useNavigation();

  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [examOpen, setExamOpen] = useState<Record<string, boolean>>({});
  const [imagingOpen, setImagingOpen] = useState<Record<string, boolean>>({});
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState(5);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const feedEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [medicalCase?.clinicalActions?.length, medicalCase?.labs?.length]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 20px', fontFamily: 'Georgia, serif' }}>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>OpenEHR Sim</h1>
        <p style={{ color: '#555', marginBottom: 24, lineHeight: 1.6 }}>
          USMLE Step 3 CCS simulator. Sign in to access cases and track your progress.
        </p>
        <button onClick={() => setIsAuthOpen(true)} style={{ padding: '8px 20px' }}>
          Sign in
        </button>
      </div>
    );
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isAuthLoading || loading || error) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 20px', fontFamily: 'Georgia, serif' }}>
        {error ? (
          <>
            <p><strong>Connection Failed</strong></p>
            <p style={{ color: '#555' }}>{error}</p>
            <button onClick={() => loadNewCase()} style={{ marginTop: 12 }}>Try again</button>
          </>
        ) : (
          <p style={{ color: '#555' }}>{loadingStep || 'Loading…'}</p>
        )}
      </div>
    );
  }

  const mc = medicalCase;
  const stream = mc ? buildStream(mc, simTime) : [];

  const vitalsLine = mc ? [
    `HR ${mc.vitals.heartRate}`,
    `BP ${mc.vitals.bloodPressure}`,
    `RR ${mc.vitals.respiratoryRate}`,
    `SpO2 ${mc.vitals.oxygenSaturation}%`,
    `T ${mc.vitals.temperature}°C`,
  ].join('  ·  ') : '';

  const isBusy = intervening || calling;

  function submitInput() {
    const val = input.trim();
    if (!val || isBusy || !mc) return;
    setInput('');
    handlePerformIntervention(5, val);
  }

  // Quick-suggest: first few labs and imaging not yet ordered
  const orderedLabNames = new Set((mc?.labs || []).map(l => l.name.toLowerCase()));
  const orderedImgTypes = new Set((mc?.imaging || []).map(i => i.type.toLowerCase()));
  const suggestLabs = (mc?.availableTests?.labs || []).filter(t => !orderedLabNames.has(t.name.toLowerCase())).slice(0, 3);
  const suggestImgs = (mc?.availableTests?.imaging || []).filter(t => !orderedImgTypes.has(t.name.toLowerCase())).slice(0, 2);
  const activeMeds = (mc?.medications || []).filter(m => m.discontinuedAt === undefined);

  // Vitals status
  const sbp = mc ? parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120 : 120;
  const isCritical = mc && (
    mc.vitals.heartRate > 150 || mc.vitals.heartRate < 40 ||
    mc.vitals.oxygenSaturation < 88 ||
    sbp < 80 || sbp > 180 ||
    mc.physiologicalTrend === 'critical'
  );

  const examSystems = mc?.physicalExam
    ? (Object.entries(mc.physicalExam) as [string, string][])
    : [];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px 160px', fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.7, color: '#111' }}>

      {/* Global modals */}
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={() => {}}
        onNewCase={() => setIsLibraryOpen(true)}
        onConsult={handleConsult}
        hasArchive={!!user}
        onOrderTest={mc ? handleOrderTest : undefined}
        onAdminister={mc ? (med) => handlePerformIntervention(2, `Administer ${med}`) : undefined}
        onAdvanceTime={mc ? handleAdvanceTime : undefined}
      />

      {/* ── Site header ── */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontWeight: 'bold', fontSize: 17, letterSpacing: 1 }}>OpenEHR Sim</span>
        {' · '}
        <a href="#" onClick={e => { e.preventDefault(); setIsLibraryOpen(true); }} style={{ color: '#111' }}>new case</a>
        {' · '}
        <a href="#" onClick={e => { e.preventDefault(); setIsCommandOpen(true); }} style={{ color: '#111' }}>commands</a>
        {user && (
          <>
            {' · '}
            <a href="#" onClick={e => { e.preventDefault(); handleLogout(); }} style={{ color: '#111' }}>sign out ({user.email})</a>
          </>
        )}
      </div>

      {!mc ? (
        <p style={{ color: '#555' }}>No case loaded. <a href="#" onClick={e => { e.preventDefault(); loadNewCase(); }} style={{ color: '#111' }}>Generate a case</a></p>
      ) : (
        <>
          {/* ── Patient header ── */}
          <div style={{ borderBottom: '1px solid #ccc', paddingBottom: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 16 }}>
              <strong>{mc.patientName}</strong>
              {' — '}
              {mc.age}y {mc.gender}
              {mc.difficulty && <span style={{ color: '#666' }}> [{mc.difficulty}]</span>}
            </p>
            <p style={{ margin: '4px 0 0', color: '#333' }}>{mc.chiefComplaint}</p>
            <p style={{ margin: '6px 0 0', fontFamily: 'monospace', fontSize: 13, color: isCritical ? '#c00' : '#333' }}>
              {vitalsLine}
              {mc.physiologicalTrend && mc.physiologicalTrend !== 'stable' && (
                <span style={{ color: mc.physiologicalTrend === 'improving' ? '#080' : '#c00' }}>
                  {' '}[{mc.physiologicalTrend}]
                </span>
              )}
            </p>
            <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 12, color: '#555' }}>
              T+{simTime}min · {mc.currentLocation}
            </p>
            {patientOutcome && patientOutcome !== 'alive' && (
              <p style={{ margin: '8px 0 0', color: '#c00', fontWeight: 'bold' }}>
                ⚠ {patientOutcome === 'deceased' ? 'Patient expired' : 'Critical deterioration'}
                {' — '}
                <a href="#" onClick={e => { e.preventDefault(); loadNewCase(); }} style={{ color: '#c00' }}>new case</a>
              </p>
            )}
          </div>

          {/* ── Collapsible history ── */}
          <div style={{ marginBottom: 16 }}>
            <a href="#" onClick={e => { e.preventDefault(); setHistoryOpen(p => !p); }} style={{ color: '#111', fontSize: 13 }}>
              {historyOpen ? '▼' : '▶'} History of Present Illness
            </a>
            {historyOpen && (
              <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: '3px solid #ccc', color: '#333' }}>
                <p style={{ margin: '0 0 8px' }}>{mc.historyOfPresentIllness}</p>
                {mc.pastMedicalHistory?.length > 0 && (
                  <>
                    <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: 13 }}>Past Medical History:</p>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {mc.pastMedicalHistory.map((h, i) => <li key={i} style={{ fontSize: 13 }}>{h}</li>)}
                    </ul>
                  </>
                )}
                {mc.initialAppearance && (
                  <>
                    <p style={{ margin: '8px 0 4px', fontWeight: 'bold', fontSize: 13 }}>Initial Appearance:</p>
                    <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic' }}>{mc.initialAppearance}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Physical exam systems ── */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#555', fontFamily: 'monospace' }}>PHYSICAL EXAM</p>
            {examSystems.map(([sys, val]) => {
              const isLocked = val === '[[LOCKED]]';
              const isRevealed = examOpen[sys];
              return (
                <div key={sys} style={{ marginBottom: 6, fontSize: 13 }}>
                  <a href="#" onClick={e => {
                    e.preventDefault();
                    if (isLocked) {
                      setMedicalCase(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          clinicalActions: [...(prev.clinicalActions || []), {
                            id: `exam-${Date.now()}`,
                            timestamp: prev.simulationTime,
                            type: 'exam' as const,
                            description: `Examined ${sys}`,
                          }]
                        };
                      });
                    }
                    setExamOpen(p => ({ ...p, [sys]: !p[sys] }));
                  }} style={{ color: '#111', textTransform: 'capitalize' }}>
                    {isRevealed ? '▼' : '▶'} {sys}
                  </a>
                  {isRevealed && !isLocked && (
                    <span style={{ color: '#333', paddingLeft: 12 }}>{val}</span>
                  )}
                  {isRevealed && isLocked && (
                    <span style={{ color: '#999', paddingLeft: 12, fontStyle: 'italic' }}>Examining...</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Active medications ── */}
          {activeMeds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: '#555', fontFamily: 'monospace' }}>ACTIVE MEDICATIONS</p>
              {activeMeds.map(m => (
                <div key={m.id} style={{ fontSize: 13, marginBottom: 4 }}>
                  {m.name} {m.dose} {m.route}
                  {' · '}
                  <a href="#" onClick={e => { e.preventDefault(); handleDiscontinueMedication(m.id, m.name); }} style={{ color: '#c00', fontSize: 12 }}>
                    d/c
                  </a>
                </div>
              ))}
            </div>
          )}

          <hr style={{ borderColor: '#ccc', marginBottom: 16 }} />

          {/* ── Event stream ── */}
          <div style={{ marginBottom: 16 }}>
            {stream.length === 0 && (
              <p style={{ color: '#999', fontSize: 13, fontStyle: 'italic' }}>No events yet.</p>
            )}
            {stream.map(item => {
              if (item.kind === 'divider') {
                return (
                  <p key={item.id} style={{ margin: '12px 0 4px', fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
                    ── T+{item.time}min ─────────────────────────────
                  </p>
                );
              }
              if (item.kind === 'action') {
                return (
                  <p key={item.id} style={{ margin: '0 0 3px', paddingLeft: 12, fontSize: 13 }}>
                    {item.text}
                    {item.impact && <span style={{ color: '#555', fontStyle: 'italic' }}> — {item.impact}</span>}
                  </p>
                );
              }
              if (item.kind === 'lab') {
                const l = item.lab;
                const flag = l.status === 'critical' ? ' [CRITICAL]' : l.status === 'abnormal' ? ' [abnormal]' : '';
                return (
                  <p key={item.id} style={{ margin: '0 0 3px', paddingLeft: 12, fontSize: 13, fontFamily: 'monospace', color: l.status === 'critical' ? '#c00' : l.status === 'abnormal' ? '#b60' : '#111' }}>
                    {l.name}: {l.value} {l.unit} (ref {l.normalRange}){flag}
                  </p>
                );
              }
              if (item.kind === 'imaging') {
                const img = item.img;
                const key = img.type;
                const open = imagingOpen[key];
                return (
                  <div key={item.id} style={{ paddingLeft: 12, marginBottom: 4 }}>
                    <a href="#" onClick={e => { e.preventDefault(); setImagingOpen(p => ({ ...p, [key]: !p[key] })); }} style={{ color: '#111', fontSize: 13, fontFamily: 'monospace' }}>
                      {open ? '▼' : '▶'} {img.type}
                    </a>
                    {open && (
                      <div style={{ paddingLeft: 16, borderLeft: '2px solid #ccc', marginTop: 4, fontSize: 13, color: '#333' }}>
                        {img.findings && <p style={{ margin: '0 0 4px' }}><em>Findings:</em> {img.findings}</p>}
                        {img.impression && <p style={{ margin: 0 }}><strong>Impression:</strong> {img.impression}</p>}
                      </div>
                    )}
                  </div>
                );
              }
              if (item.kind === 'pending') {
                return (
                  <p key={item.id} style={{ margin: '0 0 3px', paddingLeft: 12, fontSize: 13, color: '#888', fontFamily: 'monospace' }}>
                    {item.name}: pending (available T+{item.availableAt}min)
                  </p>
                );
              }
              return null;
            })}
            <div ref={feedEnd} />
          </div>

          {/* ── Quick-suggest links ── */}
          {(suggestLabs.length > 0 || suggestImgs.length > 0) && (
            <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
              <span>Order: </span>
              {suggestLabs.map((t, i) => (
                <React.Fragment key={t.name}>
                  {i > 0 && ' · '}
                  <a href="#" onClick={e => { e.preventDefault(); handleOrderTest('lab', t.name); }} style={{ color: '#111' }}>{t.name}</a>
                </React.Fragment>
              ))}
              {suggestLabs.length > 0 && suggestImgs.length > 0 && ' · '}
              {suggestImgs.map((t, i) => (
                <React.Fragment key={t.name}>
                  {i > 0 && ' · '}
                  <a href="#" onClick={e => { e.preventDefault(); handleOrderTest('imaging', t.name); }} style={{ color: '#111' }}>{t.name}</a>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ── Command input ── */}
          <form onSubmit={e => { e.preventDefault(); submitInput(); }} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isBusy ? 'Working…' : 'Type an order or action (e.g. "order CBC", "give aspirin 325mg")'}
              disabled={isBusy || !mc}
              style={{ flex: 1, padding: '6px 10px', fontSize: 14, fontFamily: 'Georgia, serif', border: '1px solid #999', background: '#fff' }}
            />
            <button type="submit" disabled={isBusy || !input.trim()} style={{ padding: '6px 16px', fontSize: 14 }}>
              Go
            </button>
          </form>

          {/* ── Bottom action links ── */}
          <div style={{ fontSize: 13, color: '#555' }}>
            <a href="#" onClick={e => { e.preventDefault(); setAdvanceOpen(p => !p); }} style={{ color: '#111' }}>advance time</a>
            {' · '}
            <a href="#" onClick={e => { e.preventDefault(); handleConsult(); }} style={{ color: '#111' }}>consult AI</a>
            {' · '}
            <a href="#" onClick={e => { e.preventDefault(); setIsDxPadOpen(true); }} style={{ color: '#111' }}>reasoning pad</a>
            {' · '}
            <a href="#" onClick={e => { e.preventDefault(); setAssessmentOpen(true); }} style={{ color: '#111' }}>end case</a>
          </div>

          {/* ── Time advance inline ── */}
          {advanceOpen && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #ccc', fontSize: 13 }}>
              <label>
                Advance by{' '}
                <select value={advanceAmount} onChange={e => setAdvanceAmount(Number(e.target.value))}>
                  {[5, 10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}
                </select>
              </label>
              {' '}
              <button onClick={() => { setAdvanceOpen(false); handleAdvanceTime(advanceAmount); }} disabled={isBusy} style={{ marginLeft: 8 }}>
                Advance
              </button>
              {' '}
              <a href="#" onClick={e => { e.preventDefault(); setAdvanceOpen(false); }} style={{ color: '#111' }}>cancel</a>
            </div>
          )}

          {/* ── AI Consultant panel ── */}
          {isConsultOpen && (
            <div style={{ marginTop: 16, padding: 16, border: '1px solid #999', background: '#fafafa', fontSize: 13 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                AI CONSULTANT
                {' '}
                <a href="#" onClick={e => { e.preventDefault(); setIsConsultOpen(false); }} style={{ color: '#555', fontWeight: 'normal' }}>[close]</a>
              </p>
              {isConsulting ? (
                <p style={{ color: '#555' }}>Consulting…</p>
              ) : consultantAdvice ? (
                <>
                  <p style={{ margin: '0 0 8px', fontStyle: 'italic' }}>{consultantAdvice.advice}</p>
                  <p style={{ margin: '0 0 8px' }}>{consultantAdvice.reasoning}</p>
                  <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>Recommended actions:</p>
                  <ol style={{ margin: 0, paddingLeft: 24 }}>
                    {consultantAdvice.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ol>
                </>
              ) : (
                <p style={{ color: '#888' }}>No consultation yet.</p>
              )}
            </div>
          )}

          {/* ── Management conflicts ── */}
          {mc.managementConflicts && mc.managementConflicts.length > 0 && (
            <div style={{ marginTop: 16, fontSize: 12, color: '#b60' }}>
              <span style={{ fontFamily: 'monospace' }}>CONFLICTS: </span>
              {mc.managementConflicts.join(' | ')}
            </div>
          )}
        </>
      )}

      {/* ── Assessment overlay ── */}
      {assessmentOpen && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 50, overflowY: 'auto', padding: '24px 20px' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', fontFamily: 'Georgia, serif' }}>
            <p style={{ marginBottom: 16 }}>
              <a href="#" onClick={e => { e.preventDefault(); setAssessmentOpen(false); }} style={{ color: '#111' }}>
                ← Back to case
              </a>
            </p>
            <AssessmentTab
              medicalCase={mc}
              simTime={simTime}
              userNotes={userNotes}
              evaluation={evaluation}
              submitting={submitting}
              logs={logs}
              differential={differential}
              onDifferentialChange={setDifferential}
              onNotesChange={setUserNotes}
              onEndCase={handleEndCase}
              onNewCase={() => { setAssessmentOpen(false); loadNewCase(); }}
            />
            {user && (
              <div style={{ marginTop: 40, borderTop: '1px solid #ccc', paddingTop: 24 }}>
                <ArchiveView user={user} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DiagnosisPad ── */}
      {mc && (
        <DiagnosisPad
          isOpen={isDxPadOpen}
          onToggle={() => setIsDxPadOpen(p => !p)}
          initialTab={dxPadInitialTab}
          problemRepresentation={reasoning.problemRepresentation}
          onProblemRepresentationChange={reasoning.setProblemRepresentation}
          prHistory={reasoning.prHistory}
          prIsDirty={reasoning.prIsDirty}
          currentStage={reasoning.currentStage}
          differentials={reasoning.differentials}
          onAddDifferential={reasoning.addDifferential}
          onRemoveDifferential={reasoning.removeDifferential}
          onSetLeadDiagnosis={reasoning.setLeadDiagnosis}
          onUpdateConfidence={reasoning.updateConfidence}
          onSetIllnessScript={reasoning.setIllnessScript}
          findings={reasoning.findings}
          onRemoveFinding={reasoning.removeFinding}
          onUpdateRelevance={reasoning.updateRelevance}
          onUpdateFindingRelevanceForDx={reasoning.updateFindingRelevanceForDx}
        />
      )}

      {/* ── Stage Commit Gate ── */}
      {mc && pendingStage && (
        <StageCommitGate
          isOpen={!!pendingStage}
          fromStage={reasoning.currentStage}
          toStage={pendingStage}
          problemRepresentation={reasoning.problemRepresentation}
          onProblemRepresentationChange={reasoning.setProblemRepresentation}
          differentials={reasoning.differentials}
          onSetLead={reasoning.setLeadDiagnosis}
          findings={reasoning.findings}
          previousPrSnapshot={reasoning.latestPrSnapshot}
          unmetRequirements={reasoning.checkStageGate(reasoning.currentStage)}
          onCommit={(fromStage) => {
            const snapId = reasoning.commitStage(fromStage, simTime);
            if (snapId && pendingStage) {
              reasoning.goToStage(pendingStage);
              setPendingStage(null);
            }
            return snapId;
          }}
          onCancel={() => setPendingStage(null)}
        />
      )}
    </div>
  );
}
