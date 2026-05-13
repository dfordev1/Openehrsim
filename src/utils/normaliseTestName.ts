/**
 * Canonical test names recognised by the CCS order system.
 * Any test name the AI generates must resolve to one of these.
 */
export const TURNAROUND: Record<string, { stat: number; routine: number }> = {
  // Labs — Common
  "CBC":               { stat: 15, routine: 30 },
  "BMP":               { stat: 15, routine: 30 },
  "CMP":               { stat: 20, routine: 45 },
  "Troponin":          { stat: 20, routine: 45 },
  "Lactate":           { stat: 10, routine: 20 },
  "Blood Culture":     { stat: 30, routine: 60 },
  "ABG":               { stat:  5, routine: 15 },
  "Coagulation Panel": { stat: 20, routine: 40 },
  "LFTs":              { stat: 20, routine: 45 },
  "Lipase":            { stat: 20, routine: 45 },
  "Urinalysis":        { stat: 15, routine: 30 },
  "Drug Screen":       { stat: 30, routine: 60 },
  "TSH":               { stat: 30, routine: 60 },
  "Procalcitonin":     { stat: 25, routine: 50 },
  "D-Dimer":           { stat: 20, routine: 40 },
  "BNP":               { stat: 20, routine: 40 },
  // Labs — Extended
  "Blood Glucose":     { stat:  5, routine: 15 },
  "HbA1c":             { stat: 30, routine: 60 },
  "Magnesium":         { stat: 15, routine: 30 },
  "Calcium":           { stat: 15, routine: 30 },
  "Phosphate":         { stat: 15, routine: 30 },
  "CRP":               { stat: 20, routine: 45 },
  "ESR":               { stat: 30, routine: 60 },
  "Fibrinogen":        { stat: 20, routine: 40 },
  "Ammonia":           { stat: 20, routine: 45 },
  "Cortisol":          { stat: 30, routine: 60 },
  "Urine Culture":     { stat: 60, routine: 120 },
  "Type and Screen":   { stat: 30, routine: 60 },
  "Crossmatch":        { stat: 30, routine: 60 },
  "VBG":               { stat:  5, routine: 15 },
  "Blood Gas":         { stat:  5, routine: 15 },
  "Ferritin":          { stat: 30, routine: 60 },
  "Iron Studies":      { stat: 30, routine: 60 },
  "Reticulocyte Count":{ stat: 20, routine: 45 },
  "Haptoglobin":       { stat: 25, routine: 50 },
  "LDH":               { stat: 20, routine: 45 },
  "Uric Acid":         { stat: 20, routine: 45 },
  "Creatine Kinase":   { stat: 20, routine: 45 },
  "Potassium":         { stat: 10, routine: 20 },
  "Sodium":            { stat: 10, routine: 20 },
  "Creatinine":        { stat: 15, routine: 30 },
  "BUN":               { stat: 15, routine: 30 },
  "Albumin":           { stat: 20, routine: 45 },
  "Bilirubin":         { stat: 20, routine: 45 },
  // Imaging
  "ECG":               { stat:  5, routine: 10 },
  "Chest X-ray":       { stat: 20, routine: 45 },
  "CT Head":           { stat: 30, routine: 60 },
  "CT Chest":          { stat: 30, routine: 60 },
  "CT Abdomen/Pelvis": { stat: 35, routine: 70 },
  "CT PE Protocol":    { stat: 35, routine: 70 },
  "Ultrasound":        { stat: 25, routine: 50 },
  "Echocardiogram":    { stat: 30, routine: 60 },
  "MRI Brain":         { stat: 45, routine: 90 },
  "X-ray":             { stat: 15, routine: 30 },
  "CT Angiogram":      { stat: 35, routine: 70 },
  "CT Spine":          { stat: 35, routine: 70 },
  "FAST Exam":         { stat:  5, routine: 10 },
  "V/Q Scan":          { stat: 45, routine: 90 },
};

/**
 * Explicit alias map: every AI variant → canonical key.
 * We do NOT use fuzzy matching here because CT types share the "ct" prefix
 * and would cross-match each other.
 */
export const ALIASES: Record<string, string> = {
  // Troponin
  "troponin i":                "Troponin",
  "troponin t":                "Troponin",
  "trop i":                    "Troponin",
  "trop t":                    "Troponin",
  "high-sensitivity troponin": "Troponin",
  "hs-troponin":               "Troponin",
  "hs troponin":               "Troponin",
  "cardiac troponin":          "Troponin",
  // BMP / CMP
  "basic metabolic panel":     "BMP",
  "comprehensive metabolic panel": "CMP",
  "comprehensive metabolic":   "CMP",
  "chem 7":                    "BMP",
  "chem7":                     "BMP",
  // CBC
  "complete blood count":      "CBC",
  "complete blood cell count": "CBC",
  // Coagulation
  "coagulation":               "Coagulation Panel",
  "pt/inr":                    "Coagulation Panel",
  "pt inr":                    "Coagulation Panel",
  "inr":                       "Coagulation Panel",
  "ptt":                       "Coagulation Panel",
  "aptt":                      "Coagulation Panel",
  "prothrombin":               "Coagulation Panel",
  // LFTs
  "liver function":            "LFTs",
  "liver function tests":      "LFTs",
  "hepatic function":          "LFTs",
  // BNP
  "nt-probnp":                 "BNP",
  "nt probnp":                 "BNP",
  "pro-bnp":                   "BNP",
  "brain natriuretic peptide": "BNP",
  // ABG
  "arterial blood gas":        "ABG",
  "blood gas":                 "ABG",
  // Lactate
  "lactic acid":               "Lactate",
  "serum lactate":             "Lactate",
  // Urinalysis
  "ua":                        "Urinalysis",
  "urine analysis":            "Urinalysis",
  // D-Dimer
  "d dimer":                   "D-Dimer",
  // Drug screen
  "toxicology screen":         "Drug Screen",
  "urine drug screen":         "Drug Screen",
  "uds":                       "Drug Screen",
  // ECG
  "ekg":                       "ECG",
  "electrocardiogram":         "ECG",
  "12-lead ecg":               "ECG",
  "12 lead ecg":               "ECG",
  // Chest X-ray
  "cxr":                       "Chest X-ray",
  "chest x ray":               "Chest X-ray",
  "chest xray":                "Chest X-ray",
  "chest radiograph":          "Chest X-ray",
  "chest pa":                  "Chest X-ray",
  // CT Head  — all explicit, no fuzzy fallback
  "ct head":                   "CT Head",
  "ct scan head":              "CT Head",
  "ct brain":                  "CT Head",
  "ct of head":                "CT Head",
  "ct of the head":            "CT Head",
  "ct non-contrast head":      "CT Head",
  "ct head without contrast":  "CT Head",
  "ct head with contrast":     "CT Head",
  "ct scan of head":           "CT Head",
  "non-contrast ct head":      "CT Head",
  // CT Chest
  "ct chest":                  "CT Chest",
  "ct scan chest":             "CT Chest",
  "ct of chest":               "CT Chest",
  "ct of the chest":           "CT Chest",
  "ct chest without contrast": "CT Chest",
  "ct chest with contrast":    "CT Chest",
  "ct scan of chest":          "CT Chest",
  "ct thorax":                 "CT Chest",
  // CT PE Protocol
  "ct pulmonary angiography":  "CT PE Protocol",
  "ctpa":                      "CT PE Protocol",
  "ct angiography chest":      "CT PE Protocol",
  "ct pulmonary embolism":     "CT PE Protocol",
  "ct pe":                     "CT PE Protocol",
  // CT Abdomen/Pelvis
  "ct abdomen/pelvis":         "CT Abdomen/Pelvis",
  "ct abdomen":                "CT Abdomen/Pelvis",
  "ct pelvis":                 "CT Abdomen/Pelvis",
  "ct ab/pelvis":              "CT Abdomen/Pelvis",
  "ct abdomen and pelvis":     "CT Abdomen/Pelvis",
  "ct of abdomen":             "CT Abdomen/Pelvis",
  "ct of abdomen and pelvis":  "CT Abdomen/Pelvis",
  "ct scan abdomen":           "CT Abdomen/Pelvis",
  "ct scan abdomen and pelvis":"CT Abdomen/Pelvis",
  "ct abdomen pelvis":         "CT Abdomen/Pelvis",
  // Echocardiogram
  "echo":                      "Echocardiogram",
  "cardiac echo":              "Echocardiogram",
  "transthoracic echo":        "Echocardiogram",
  "tte":                       "Echocardiogram",
  // MRI Brain
  "mri head":                  "MRI Brain",
  "mri of the brain":          "MRI Brain",
  // Ultrasound
  "us":                        "Ultrasound",
  "bedside us":                "Ultrasound",
  "point of care ultrasound":  "Ultrasound",
  "pocus":                     "Ultrasound",
  "renal ultrasound":          "Ultrasound",
  "abdominal ultrasound":      "Ultrasound",
  // Blood culture
  "blood cultures":            "Blood Culture",
  // Blood Glucose
  "glucose":                   "Blood Glucose",
  "bgl":                       "Blood Glucose",
  "blood sugar":               "Blood Glucose",
  "finger stick":              "Blood Glucose",
  "fingerstick glucose":       "Blood Glucose",
  "point of care glucose":     "Blood Glucose",
  // VBG
  "venous blood gas":          "VBG",
  // CRP
  "c-reactive protein":        "CRP",
  "c reactive protein":        "CRP",
  // Magnesium
  "mag":                       "Magnesium",
  "mg level":                  "Magnesium",
  "serum magnesium":           "Magnesium",
  // Calcium
  "ca level":                  "Calcium",
  "serum calcium":             "Calcium",
  "ionized calcium":           "Calcium",
  // Potassium
  "k level":                   "Potassium",
  "serum potassium":           "Potassium",
  // Creatinine
  "creat":                     "Creatinine",
  "serum creatinine":          "Creatinine",
  // CK
  "ck":                        "Creatine Kinase",
  "cpk":                       "Creatine Kinase",
  "creatine phosphokinase":    "Creatine Kinase",
  // Type and screen
  "type and cross":            "Type and Screen",
  "crossmatch":                "Crossmatch",
  "blood bank":                "Type and Screen",
  // Iron
  "iron":                      "Iron Studies",
  "iron panel":                "Iron Studies",
  "serum iron":                "Iron Studies",
  // LDH
  "lactate dehydrogenase":     "LDH",
  // Ammonia
  "serum ammonia":             "Ammonia",
  "nh3":                       "Ammonia",
  // Cortisol
  "random cortisol":           "Cortisol",
  "am cortisol":               "Cortisol",
  // Imaging extras
  "fast":                      "FAST Exam",
  "fast exam":                 "FAST Exam",
  "focused assessment":        "FAST Exam",
  "vq scan":                   "V/Q Scan",
  "ventilation perfusion":     "V/Q Scan",
  "v/q":                       "V/Q Scan",
  "ct angiogram":              "CT Angiogram",
  "cta":                       "CT Angiogram",
  "ct angio":                  "CT Angiogram",
  "ct spine":                  "CT Spine",
  "ct c-spine":                "CT Spine",
  "ct cervical spine":         "CT Spine",
  "x-ray":                     "X-ray",
  "xray":                      "X-ray",
  "x ray":                     "X-ray",
  "pelvic xray":               "X-ray",
  "ankle xray":                "X-ray",
  "wrist xray":                "X-ray",
  "knee xray":                 "X-ray",
  "abdominal xray":            "X-ray",
  "kub":                       "X-ray",
};

/**
 * Normalise any test name → canonical TURNAROUND key.
 *
 * Resolution order:
 *  1. Exact case-insensitive match against TURNAROUND keys
 *  2. Exact lookup in ALIASES (covers every known variant)
 *  3. Prefix match against ALIASES entries (min length 4, no "ct" ambiguity)
 *
 * Returns the raw string unchanged if nothing matches — the caller
 * should use DEFAULT_TURNAROUND instead of rejecting the order.
 */
export function normaliseTestName(raw: string): string {
  const lower = raw.trim().toLowerCase();

  // 1. Exact match against canonical keys
  const exact = Object.keys(TURNAROUND).find(k => k.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Alias lookup
  if (ALIASES[lower]) return ALIASES[lower];

  // 3. Safe prefix match against alias keys (≥ 4 chars to avoid "ct" ambiguity)
  const prefixMatch = Object.entries(ALIASES).find(
    ([alias]) => alias.length >= 4 && lower.startsWith(alias)
  );
  if (prefixMatch) return prefixMatch[1];

  return raw;
}

/** Default turnaround times for tests not in the canonical list.
 *  Used so we never reject a valid clinical order. */
export const DEFAULT_TURNAROUND = {
  lab:     { stat: 20, routine: 45 },
  imaging: { stat: 30, routine: 60 },
};
