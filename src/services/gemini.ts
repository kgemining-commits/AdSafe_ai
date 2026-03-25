import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION, KNOWLEDGE_BASE } from "../constants";

export interface ComplianceIssue {
  violation_type: string;
  original_text: string;
  reason: string;
  recommended_phrases: string[];
}

export interface QualityIssue {
  issue_type: string;
  original_text: string;
  reason: string;
  recommended_phrases: string[];
}

export interface ReviewResult {
  overall_status: "PASS" | "WARNING" | "FAIL";
  compliance_issues: ComplianceIssue[];
  grammar_and_context_issues: QualityIssue[];
}

export async function reviewAdvertisement(
  adType: string,
  mediaType: string,
  content: string,
  imageDescription?: string
): Promise<ReviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
[KNOWLEDGE_BASE]
${KNOWLEDGE_BASE}

[USER_INPUT]
광고물 종류: ${adType}
게재 매체: ${mediaType}
광고물 텍스트: ${content}
${imageDescription ? `이미지 묘사: ${imageDescription}` : ""}

위 내용을 바탕으로 [KNOWLEDGE_BASE]의 규정을 준수하여 심의를 진행해 주세요.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overall_status: { type: Type.STRING, enum: ["PASS", "WARNING", "FAIL"] },
            compliance_issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  violation_type: { type: Type.STRING },
                  original_text: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  recommended_phrases: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["violation_type", "original_text", "reason", "recommended_phrases"]
              }
            },
            grammar_and_context_issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  issue_type: { type: Type.STRING },
                  original_text: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  recommended_phrases: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["issue_type", "original_text", "reason", "recommended_phrases"]
              }
            }
          },
          required: ["overall_status", "compliance_issues", "grammar_and_context_issues"]
        }
      }
    });

    if (!response || !response.text) {
      throw new Error("AI model returned an empty or invalid response.");
    }

    const text = response.text.trim();
    
    try {
      const result = JSON.parse(text);
      return {
        overall_status: result.overall_status || "WARNING",
        compliance_issues: result.compliance_issues || [],
        grammar_and_context_issues: result.grammar_and_context_issues || []
      };
    } catch (parseError) {
      console.error("JSON Parse Error:", text);
      throw new Error("Failed to parse AI response as JSON. Please try again.");
    }
  } catch (error) {
    console.error("AI Review Error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred during AI review.");
  }
}
