
require("dotenv").config();

async function testGemini() {
    try {
        console.log("Testing Gemini API...");

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing from .env");
        }

        const { GoogleGenAI } = await import("@google/genai");

        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });

        const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

        console.log("Selected model:", model);

        const response = await ai.models.generateContent({
            model: model,
            contents: "Reply with exactly this sentence: Gemini API is working successfully."
        });

        console.log("\nGEMINI RESPONSE:");
        console.log(response.text);

        console.log("\nGemini API test completed successfully.");

    } catch (error) {
        console.error("\nGEMINI API TEST FAILED:");
        console.error(error.message);

        if (error.status) {
            console.error("HTTP Status:", error.status);
        }
    }
}

testGemini();
