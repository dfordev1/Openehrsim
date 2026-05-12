import { GoogleGenAI, Type } from "@google/genai";
import { MedicalCase, ConsultantAdvice } from "../types";

export async function getConsultantAdvice(medicalCase: MedicalCase): Promise<ConsultantAdvice> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following medical case and provide consultant-level advice. 
    State the current most likely differential diagnosis, reasoning, and suggest the top 3 immediate next steps.
    
    Case: ${JSON.stringify(medicalCase)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          advice: { type: Type.STRING, description: "A high-level clinical summary and recommendation." },
          reasoning: { type: Type.STRING, description: "The underlying pathophysiological or clinical reasoning for the advice." },
          recommendedActions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "A list of urgent next steps or orders."
          }
        },
        required: ["advice", "reasoning", "recommendedActions"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Consultant was unable to provide advice.");
  
  return JSON.parse(text);
}
