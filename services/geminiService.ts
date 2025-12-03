import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateCypherQuery = async (prompt: string): Promise<string> => {
  if (!process.env.API_KEY) return "// API Key missing. Please provide a key to generate queries.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert in Quine (streaming graph) and Cypher query language.
      Generate a valid, optimized Cypher query for the following request: "${prompt}".
      
      CRITICAL: The output must be visualized in a 3D graph. 
      Ensure the query explicitly returns nodes and relationships (e.g., 'RETURN n, r, m' or 'RETURN path').
      Do NOT return just counts or tables unless specifically asked.
      
      Return ONLY the Cypher code, no markdown formatting, no explanations.`,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "// Error generating query. Please try again.";
  }
};