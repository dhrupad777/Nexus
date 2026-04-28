import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({ apiKey: "AIzaSyD0RTsq-yljKlNKLapGpV58Y8eOyixXpb0" });
  try {
    const resp = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: "Hello world",
      config: {
        outputDimensionality: 768
      }
    });
    console.log("gemini-embedding-2 dims:", resp.embeddings?.[0]?.values?.length);
  } catch (e) {
    console.error(e);
  }
}

main();
