import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in backend/.env");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: "Can I send my mug back?",
    config: { outputDimensionality: 768 },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("No embedding returned");
  }

  console.log("Numbers in the embedding:", values.length);
  console.log("First 5 numbers:", values.slice(0, 5));
}

main().catch((error) => {
  console.error("Test failed:", error.message);
});