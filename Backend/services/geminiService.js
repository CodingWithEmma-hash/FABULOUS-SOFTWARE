
require("dotenv").config();

let aiClient;

async function getAIClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API key is missing from the backend .env file.");
    }

    if (!aiClient) {
        const { GoogleGenAI } = await import("@google/genai");

        aiClient = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
    }

    return aiClient;
}

async function generateClinicalAssessment(patientData) {
    const ai = await getAIClient();

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const prompt = `
You are an AI clinical decision-support assistant.

Your task is to analyse the supplied patient assessment information
and provide preliminary clinical decision-support information for
a qualified healthcare professional.

IMPORTANT SAFETY RULES:
1. Do not claim to establish a confirmed diagnosis.
2. Do not prescribe medications or recommend medication dosages.
3. Do not replace the judgment of a qualified healthcare professional.
4. Identify concerning symptoms and abnormal vital signs.
5. Never describe a potentially serious presentation as definitely safe.
6. If information is missing, explicitly acknowledge the limitation.
7. Recommend urgent clinical assessment when the information suggests
   a potentially serious or time-sensitive condition.
8. Use clear, professional and understandable language.
9. Base your response only on the supplied information.
10. Do not invent symptoms, measurements or patient history.

PATIENT ASSESSMENT INFORMATION:

${JSON.stringify(patientData, null, 2)}

Return a structured assessment containing:
- A brief clinical summary.
- Important observations.
- Practical recommendations for the clinician.
- Any identified warning signs.
- A suggested review priority.

Your response is preliminary decision support and must be reviewed
by a qualified healthcare professional.
`;

    
let response;
let lastError;

for (let attempt = 1; attempt <= 3; attempt++) {
    try {
        console.log(`Gemini request attempt ${attempt}/3`);

        response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                temperature: 0.2,
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    properties: {
                        clinical_summary: {
                            type: "string"
                        },
                        observations: {
                            type: "array",
                            items: { type: "string" }
                        },
                        recommendations: {
                            type: "array",
                            items: { type: "string" }
                        },
                        warning_signs: {
                            type: "array",
                            items: { type: "string" }
                        },
                        suggested_review_priority: {
                            type: "string",
                            enum: ["Routine", "Prompt", "Urgent"]
                        }
                    },
                    required: [
                        "clinical_summary",
                        "observations",
                        "recommendations",
                        "warning_signs",
                        "suggested_review_priority"
                    ]
                }
            }
        });

        break;

    } catch (error) {
        lastError = error;

        const errorMessage = error.message || "";

        const isTemporary =
            error.status === 503 ||
            error.status === 429 ||
            error.status === 500 ||
            errorMessage.includes('"code":503') ||
            errorMessage.includes('"code":429') ||
            errorMessage.includes('"code":500');

        if (!isTemporary || attempt === 3) {
            throw error;
        }

        const delay = attempt * 2000;

        console.log(
            `Gemini temporarily unavailable. Retrying in ${delay / 1000} seconds...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

if (!response) {
    throw lastError || new Error("Gemini could not generate a response.");
}


    const responseText = response.text;

    if (!responseText) {
        throw new Error("Gemini returned an empty response.");
    }

    let result;

    try {
        result = JSON.parse(responseText);
    } catch (error) {
        throw new Error("Gemini returned an invalid JSON response.");
    }

    // Validate the essential response fields.
    if (
        typeof result.clinical_summary !== "string" ||
        !Array.isArray(result.observations) ||
        !Array.isArray(result.recommendations) ||
        !Array.isArray(result.warning_signs) ||
        !["Routine", "Prompt", "Urgent"].includes(
            result.suggested_review_priority
        )
    ) {
        throw new Error("Gemini returned an incomplete assessment.");
    }

    return result;
}

module.exports = {
    generateClinicalAssessment
};
