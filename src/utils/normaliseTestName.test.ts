import { describe, it, expect } from 'vitest';
import { normaliseTestName } from './normaliseTestName';

// ── Exact canonical pass-through ─────────────────────────────────────────────
describe('canonical names pass through unchanged', () => {
  const canonical = [
    'CBC', 'BMP', 'CMP', 'Troponin', 'Lactate', 'Blood Culture', 'ABG',
    'Coagulation Panel', 'LFTs', 'Lipase', 'Urinalysis', 'Drug Screen',
    'TSH', 'Procalcitonin', 'D-Dimer', 'BNP', 'ECG', 'Chest X-ray',
    'CT Head', 'CT Chest', 'CT Abdomen/Pelvis', 'CT PE Protocol',
    'Ultrasound', 'Echocardiogram', 'MRI Brain',
  ];
  canonical.forEach(name => {
    it(name, () => expect(normaliseTestName(name)).toBe(name));
  });
});

// ── Troponin variants ─────────────────────────────────────────────────────────
describe('Troponin', () => {
  it('Troponin I',                () => expect(normaliseTestName('Troponin I')).toBe('Troponin'));
  it('Troponin T',                () => expect(normaliseTestName('Troponin T')).toBe('Troponin'));
  it('Trop I',                    () => expect(normaliseTestName('Trop I')).toBe('Troponin'));
  it('high-sensitivity troponin', () => expect(normaliseTestName('high-sensitivity troponin')).toBe('Troponin'));
  it('hs-Troponin (mixed case)',  () => expect(normaliseTestName('hs-Troponin')).toBe('Troponin'));
  it('cardiac troponin',          () => expect(normaliseTestName('cardiac troponin')).toBe('Troponin'));
});

// ── ECG variants ──────────────────────────────────────────────────────────────
describe('ECG', () => {
  it('EKG',              () => expect(normaliseTestName('EKG')).toBe('ECG'));
  it('electrocardiogram',() => expect(normaliseTestName('electrocardiogram')).toBe('ECG'));
  it('12-lead ECG',      () => expect(normaliseTestName('12-lead ECG')).toBe('ECG'));
});

// ── CT scans do NOT cross-match ───────────────────────────────────────────────
describe('CT scans resolve correctly and do not cross-match', () => {
  it('CT Head stays CT Head',             () => expect(normaliseTestName('CT Head')).toBe('CT Head'));
  it('CT Chest stays CT Chest',           () => expect(normaliseTestName('CT Chest')).toBe('CT Chest'));
  it('CT Abdomen/Pelvis stays',           () => expect(normaliseTestName('CT Abdomen/Pelvis')).toBe('CT Abdomen/Pelvis'));
  it('CT PE Protocol stays',              () => expect(normaliseTestName('CT PE Protocol')).toBe('CT PE Protocol'));

  it('CT Brain → CT Head',                () => expect(normaliseTestName('CT Brain')).toBe('CT Head'));
  it('CT Scan Head → CT Head',            () => expect(normaliseTestName('CT Scan Head')).toBe('CT Head'));
  it('CT Thorax → CT Chest',              () => expect(normaliseTestName('CT Thorax')).toBe('CT Chest'));
  it('CTPA → CT PE Protocol',             () => expect(normaliseTestName('CTPA')).toBe('CT PE Protocol'));
  it('CT Pulmonary Angiography → CT PE',  () => expect(normaliseTestName('CT Pulmonary Angiography')).toBe('CT PE Protocol'));
  it('CT Abdomen → CT Abdomen/Pelvis',    () => expect(normaliseTestName('CT Abdomen')).toBe('CT Abdomen/Pelvis'));
  it('CT Abdomen and Pelvis',             () => expect(normaliseTestName('CT Abdomen and Pelvis')).toBe('CT Abdomen/Pelvis'));
  it('CT Pelvis → CT Abdomen/Pelvis',     () => expect(normaliseTestName('CT Pelvis')).toBe('CT Abdomen/Pelvis'));

  // Critical: no cross-matching
  it('CT Head does NOT resolve to CT Chest',          () => expect(normaliseTestName('CT Head')).not.toBe('CT Chest'));
  it('CT Chest does NOT resolve to CT Head',          () => expect(normaliseTestName('CT Chest')).not.toBe('CT Head'));
  it('CT Chest does NOT resolve to CT Abdomen/Pelvis',() => expect(normaliseTestName('CT Chest')).not.toBe('CT Abdomen/Pelvis'));
  it('CT Abdomen does NOT resolve to CT Head',        () => expect(normaliseTestName('CT Abdomen')).not.toBe('CT Head'));
  it('CT Abdomen does NOT resolve to CT Chest',       () => expect(normaliseTestName('CT Abdomen')).not.toBe('CT Chest'));
});

// ── Chest X-ray variants ──────────────────────────────────────────────────────
describe('Chest X-ray', () => {
  it('CXR',              () => expect(normaliseTestName('CXR')).toBe('Chest X-ray'));
  it('chest xray',       () => expect(normaliseTestName('chest xray')).toBe('Chest X-ray'));
  it('Chest Radiograph', () => expect(normaliseTestName('Chest Radiograph')).toBe('Chest X-ray'));
});

// ── Coagulation variants ──────────────────────────────────────────────────────
describe('Coagulation Panel', () => {
  it('PT/INR',       () => expect(normaliseTestName('PT/INR')).toBe('Coagulation Panel'));
  it('INR',          () => expect(normaliseTestName('INR')).toBe('Coagulation Panel'));
  it('PTT',          () => expect(normaliseTestName('PTT')).toBe('Coagulation Panel'));
  it('Coagulation',  () => expect(normaliseTestName('Coagulation')).toBe('Coagulation Panel'));
});

// ── Echocardiogram variants ───────────────────────────────────────────────────
describe('Echocardiogram', () => {
  it('Echo',              () => expect(normaliseTestName('Echo')).toBe('Echocardiogram'));
  it('TTE',               () => expect(normaliseTestName('TTE')).toBe('Echocardiogram'));
  it('cardiac echo',      () => expect(normaliseTestName('cardiac echo')).toBe('Echocardiogram'));
});

// ── Unknown returns raw ───────────────────────────────────────────────────────
describe('unknown names', () => {
  it('gibberish returns unchanged', () => expect(normaliseTestName('FooBarTest')).toBe('FooBarTest'));
  it('empty string returns empty',  () => expect(normaliseTestName('')).toBe(''));
});

// ── Case-insensitivity ────────────────────────────────────────────────────────
describe('case insensitive', () => {
  it('cbc → CBC',           () => expect(normaliseTestName('cbc')).toBe('CBC'));
  it('LACTATE → Lactate',   () => expect(normaliseTestName('LACTATE')).toBe('Lactate'));
  it('ct head → CT Head',   () => expect(normaliseTestName('ct head')).toBe('CT Head'));
  it('  CBC  (whitespace)', () => expect(normaliseTestName('  CBC  ')).toBe('CBC'));
});
