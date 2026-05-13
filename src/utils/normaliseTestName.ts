/**
 * Test name normalisation for the CCS order system.
 *
 * Turnaround times are declared per-test by the AI in availableTests at case
 * generation time. This file provides:
 *   - normaliseTestName(): maps common abbreviations to canonical names so
 *     user input can be matched against the AI-generated catalog.
 *   - inferTurnaround(): keyword-based fallback for any test the user types
 *     that is not found in the case catalog (e.g. a free-text custom order).
 *
 * There is NO hard-coded TURNAROUND lookup table.
 */

export const ALIASES: Record<string, string> = {
  // Blood gas
  "arterial blood gas":          "ABG",
  "blood gas":                   "ABG",
  "venous blood gas":            "VBG",
  // Troponin
  "trop i":                      "Troponin",
  "trop t":                      "Troponin",
  "hs-troponin":                 "Troponin",
  "hs troponin":                 "Troponin",
  "troponin i":                  "Troponin",
  "troponin t":                  "Troponin",
  "high-sensitivity troponin":   "Troponin",
  "hstni":                       "Troponin",
  // CBC / BMP / CMP
  "complete blood count":        "CBC",
  "full blood count":            "CBC",
  "fbc":                         "CBC",
  "basic metabolic panel":       "BMP",
  "chem 7":                      "BMP",
  "chem7":                       "BMP",
  "comprehensive metabolic panel":"CMP",
  "comprehensive metabolic":     "CMP",
  // Coagulation
  "pt/inr":                      "Coagulation Panel",
  "pt inr":                      "Coagulation Panel",
  "inr":                         "Coagulation Panel",
  "ptt":                         "Coagulation Panel",
  "aptt":                        "Coagulation Panel",
  "coags":                       "Coagulation Panel",
  "clotting screen":             "Coagulation Panel",
  // LFTs
  "liver function tests":        "LFTs",
  "liver function":              "LFTs",
  "liver panel":                 "LFTs",
  "hepatic function":            "LFTs",
  "ast/alt":                     "LFTs",
  // BNP
  "nt-probnp":                   "BNP",
  "nt probnp":                   "BNP",
  "pro-bnp":                     "BNP",
  "brain natriuretic peptide":   "BNP",
  // ECG
  "ekg":                         "ECG",
  "electrocardiogram":           "ECG",
  "12-lead ecg":                 "ECG (12-Lead)",
  "12 lead ecg":                 "ECG (12-Lead)",
  "12 lead ekg":                 "ECG (12-Lead)",
  "12-lead ekg":                 "ECG (12-Lead)",
  // Chest X-ray
  "cxr":                         "Chest X-ray",
  "chest x ray":                 "Chest X-ray",
  "chest xray":                  "Chest X-ray",
  "chest radiograph":            "Chest X-ray",
  "chest pa":                    "Chest X-ray",
  "portable cxr":                "Chest X-ray",
  "ap cxr":                      "Chest X-ray",
  // CT — explicit to avoid cross-matching on "ct" prefix
  "ct brain":                    "CT Head",
  "ct scan head":                "CT Head",
  "ct of head":                  "CT Head",
  "ct head without contrast":    "CT Head",
  "ct head with contrast":       "CT Head",
  "nchct":                       "CT Head",
  "ct thorax":                   "CT Chest",
  "ct chest without contrast":   "CT Chest",
  "ct chest with contrast":      "CT Chest",
  "ct pulmonary angiography":    "CT PE Protocol",
  "ctpa":                        "CT PE Protocol",
  "ct pe":                       "CT PE Protocol",
  "ct abdomen":                  "CT Abdomen/Pelvis",
  "ct abdomen and pelvis":       "CT Abdomen/Pelvis",
  "ct abdomen pelvis":           "CT Abdomen/Pelvis",
  // Echo
  "echo":                        "Echocardiogram",
  "tte":                         "Echocardiogram",
  "transthoracic echo":          "Echocardiogram",
  "tee":                         "Transesophageal Echo",
  // MRI
  "mri head":                    "MRI Brain",
  "mri of the brain":            "MRI Brain",
  "mri c-spine":                 "MRI Spine",
  "mri lumbar spine":            "MRI Spine",
  // Ultrasound
  "us":                          "Ultrasound",
  "pocus":                       "Ultrasound",
  "point of care ultrasound":    "Ultrasound",
  "bedside us":                  "Ultrasound",
  "fast":                        "FAST Exam",
  "focused assessment":          "FAST Exam",
  // Labs
  "lactic acid":                 "Lactate",
  "serum lactate":               "Lactate",
  "blood lactate":               "Lactate",
  "ua":                          "Urinalysis",
  "urine analysis":              "Urinalysis",
  "d dimer":                     "D-Dimer",
  "toxicology screen":           "Drug Screen",
  "urine drug screen":           "Drug Screen",
  "uds":                         "Drug Screen",
  "tox screen":                  "Drug Screen",
  "blood cultures":              "Blood Culture",
  "blood culture x2":            "Blood Culture",
  "glucose":                     "Blood Glucose",
  "fingerstick":                 "Blood Glucose",
  "cbg":                         "Blood Glucose",
  "finger stick glucose":        "Blood Glucose",
  "istat":                       "iStat Panel",
  "c-reactive protein":          "CRP",
  "serum magnesium":             "Magnesium",
  "serum calcium":               "Calcium",
  "serum potassium":             "Potassium",
  "k level":                     "Potassium",
  "serum creatinine":            "Creatinine",
  "creat":                       "Creatinine",
  "ck":                          "Creatine Kinase",
  "cpk":                         "Creatine Kinase",
  "creatine phosphokinase":      "Creatine Kinase",
  "lactate dehydrogenase":       "LDH",
  "hb electrophoresis":          "Hemoglobin Electrophoresis",
  "peripheral blood smear":      "Peripheral Smear",
  "blood film":                  "Peripheral Smear",
  "direct antiglobulin test":    "Direct Coombs",
  "dat":                         "Direct Coombs",
  "type and cross":              "Type and Screen",
  "t&s":                         "Type and Screen",
  "spep":                        "Serum Protein Electrophoresis",
  "protein electrophoresis":     "Serum Protein Electrophoresis",
  "free kappa lambda":           "Free Light Chains",
  "adamts 13":                   "ADAMTS13 Activity",
  "adamts-13":                   "ADAMTS13 Activity",
  "anti-gbm":                    "Anti-GBM Antibody",
  "anti gbm":                    "Anti-GBM Antibody",
  "apla":                        "Anti-Phospholipid Panel",
  "lupus anticoagulant":         "Anti-Phospholipid Panel",
  "anticardiolipin":             "Anti-Phospholipid Panel",
  "c-anca":                      "ANCA",
  "p-anca":                      "ANCA",
  "pr3/mpo":                     "ANCA",
  "antineutrophil cytoplasmic":  "ANCA",
  "ana screen":                  "ANA",
  "antinuclear antibody":        "ANA",
  "anti-ds-dna":                 "Anti-dsDNA",
  "anti dsdna":                  "Anti-dsDNA",
  "c3/c4":                       "Complement C3/C4",
  "ch50":                        "Complement CH50",
  "beta glucan":                 "Beta-Glucan",
  "fungitell":                   "Beta-Glucan",
  "parathyroid hormone":         "PTH",
  "intact pth":                  "PTH",
  "25-oh vitamin d":             "Vitamin D",
  "vit d":                       "Vitamin D",
  "a1c":                         "HbA1c",
  "haemoglobin a1c":             "HbA1c",
  "hemoglobin a1c":              "HbA1c",
  "g6pd screen":                 "G6PD",
  "urine na":                    "Urine Electrolytes",
  "fena":                        "Urine Electrolytes",
  "urine osm":                   "Urine Osmolality",
  "spot urine protein":          "Urine Protein/Cr Ratio",
  "urine pcr":                   "Urine Protein/Cr Ratio",
  "urine cultures":              "Urine Culture",
  "lp":                          "Lumbar Puncture",
  "spinal tap":                  "Lumbar Puncture",
  "csf":                         "Lumbar Puncture",
  "vq scan":                     "V/Q Scan",
  "v/q":                         "V/Q Scan",
  "cta":                         "CT Angiogram",
  "ct angio":                    "CT Angiogram",
  "x-ray":                       "X-ray",
  "xray":                        "X-ray",
  "x ray":                       "X-ray",
  "kub":                         "X-ray",
  "thyroid stimulating hormone": "TSH",
  "tfts":                        "Thyroid Panel",
  "free thyroxine":              "Free T4",
  "ft4":                         "Free T4",
  "b12":                         "Vitamin B12",
  "cobalamin":                   "Vitamin B12",
  "folic acid":                  "Folate",
  "serum ammonia":               "Ammonia",
  "nh3":                         "Ammonia",
  "am cortisol":                 "Cortisol",
  "random cortisol":             "Cortisol",
  "hiv rapid":                   "HIV Test",
  "4th gen hiv":                 "HIV Test",
  "hep panel":                   "Hepatitis Panel",
  "hbsag":                       "Hepatitis Panel",
  "hcv":                         "Hepatitis Panel",
  "iron panel":                  "Iron Studies",
  "serum iron":                  "Iron Studies",
  "tibc":                        "Iron Studies",
  "retic count":                 "Reticulocyte Count",
  "reticulocytes":               "Reticulocyte Count",
};

/** Normalise user-typed test name → canonical display name for catalog matching. */
export function normaliseTestName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return ALIASES[lower] ?? raw.trim();
}

/**
 * Keyword-based turnaround inference — fallback only.
 * Called when a test is NOT found in the case's availableTests catalog.
 * Works for any test name without a lookup table.
 */
export function inferTurnaround(
  name: string,
  testType: 'lab' | 'imaging'
): { stat: number; routine: number } {
  const n = name.toLowerCase();

  if (testType === 'imaging') {
    if (/\bmri\b/.test(n))                                                    return { stat:  75, routine: 150 };
    if (/\bpet\b/.test(n) || n.includes('nuclear'))                            return { stat: 180, routine: 480 };
    if (n.includes('ecg') || n.includes('ekg') || n.includes('electrocardiogram')) return { stat: 5, routine: 10 };
    if (n.includes('fast') || n.includes('pocus'))                             return { stat:   5, routine:  10 };
    if (n.includes('echocardiogram') || (n.includes('echo') && !n.includes('ecg'))) return { stat: 45, routine: 90 };
    if (n.includes('doppler') || n.includes('duplex'))                         return { stat:  45, routine:  90 };
    if (n.includes('ultrasound'))                                               return { stat:  25, routine:  60 };
    if (/\bct\b/.test(n) || n.includes('computed tomography'))                 return { stat:  35, routine:  75 };
    if (n.includes('x-ray') || n.includes('xray') || n.includes('radiograph')) return { stat:  15, routine:  45 };
    if (n.includes('angiogram') || n.includes('angiography'))                  return { stat:  40, routine:  90 };
    if (n.includes('v/q') || n.includes('ventilation perfusion'))              return { stat:  90, routine: 180 };
    if (n.includes('bone scan') || n.includes('scintigraphy'))                 return { stat: 300, routine: 480 };
    return { stat: 30, routine: 90 };
  }

  // Labs — most specific first
  if (n.includes('adamts'))                                                     return { stat: 1440, routine: 4320 };
  if (n.includes('anti-gbm') || n.includes('anti gbm') || n.includes('goodpasture')) return { stat: 720, routine: 4320 };
  if (n.includes('cryoglob'))                                                   return { stat: 2880, routine: 4320 };
  if (n.includes('phospholipid') || n.includes('cardiolipin') || (n.includes('lupus') && n.includes('anticoag'))) return { stat: 1440, routine: 4320 };
  if (n.includes('factor v leiden') || n.includes('prothrombin gene'))          return { stat: 1440, routine: 4320 };
  if (n.includes('culture'))                                                     return { stat: 2880, routine: 4320 };
  if (n.includes('pcr') || n.includes('viral load'))                            return { stat:  480, routine: 1440 };
  if (n.includes('glucan') || n.includes('galactomannan'))                      return { stat:  480, routine: 1440 };
  if (n.includes('anca') || n.includes('pr3'))                                  return { stat:  480, routine: 2880 };
  if (n.includes('anti-ds') || n.includes('anti ds-dna') || n.includes('anti dsdna')) return { stat: 480, routine: 2880 };
  if (n.includes('antinuclear') || /\bana\b/.test(n))                           return { stat:  240, routine: 1440 };
  if (n.includes('complement') || /\bc[34]\b/.test(n) || n.includes('ch50'))   return { stat:  240, routine:  480 };
  if (n.includes('electrophoresis') || n.includes('immunofixation') || n.includes('light chain')) return { stat: 240, routine: 720 };
  if (n.includes('fingerstick') || n.includes('poc glucose') || n.includes('istat')) return { stat: 2, routine: 5 };
  if (n.includes('blood gas') || /\babg\b/.test(n) || /\bvbg\b/.test(n))       return { stat:   5, routine:  15 };
  if (n.includes('lactate') || n.includes('lactic acid'))                       return { stat:  10, routine:  25 };
  if (n.includes('potassium') || n.includes('sodium') || n.includes('bicarbonate')) return { stat: 10, routine: 30 };
  if (n.includes('cbc') || n.includes('complete blood') || n.includes('full blood')) return { stat: 15, routine: 45 };
  if (n.includes('troponin'))                                                    return { stat:  20, routine:  60 };
  if (n.includes('cortisol') || /\bpth\b/.test(n) || /\btsh\b/.test(n) || n.includes('thyroid')) return { stat: 45, routine: 120 };
  if (n.includes('vitamin') || /\bb12\b/.test(n) || n.includes('folate'))      return { stat: 120, routine: 240 };
  if (n.includes('hiv'))                                                         return { stat:  60, routine: 120 };
  if (n.includes('hepatitis'))                                                   return { stat:  60, routine: 180 };
  return { stat: 20, routine: 60 };
}
