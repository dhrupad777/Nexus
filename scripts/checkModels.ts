import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({ apiKey: "AIzaSyD0RTsq-yljKlNKLapGpV58Y8eOyixXpb0" });
  try {
    const response = await ai.models.list();
    for await (const model of response) {
      if (model.name.includes("embed")) {
        console.log(model.name);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

main();
