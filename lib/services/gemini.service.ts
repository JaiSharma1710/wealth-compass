import "server-only";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Flash-Lite answers in seconds on the free tier; the larger Flash models can take
// over a minute, past Vercel's function limit. Override with GEMINI_MODEL.
const DEFAULT_MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"];
const RETRYABLE_STATUS = new Set([404, 429, 500, 503]);

export function getGeminiModels() {
  return process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...DEFAULT_MODELS] : DEFAULT_MODELS;
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Calls Gemini with a response schema so the reply is guaranteed JSON of that shape.
 * Schema uses Gemini's OpenAPI subset (type: "OBJECT" | "ARRAY" | "STRING" | ...).
 */
export async function generateStructured<T>(input: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  let lastError: Error | null = null;

  // Fall through to the next model when one is overloaded, rate-limited or retired.
  for (const model of getGeminiModels()) {
    const response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.4,
          responseMimeType: "application/json",
          responseSchema: input.schema,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const result = (await response.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      error?: { message?: string };
      modelVersion?: string;
    } | null;

    if (!response.ok) {
      const quota = response.status === 429 ? " (free-tier quota reached, try again later)" : "";
      lastError = new Error(`Gemini request failed${quota}: ${result?.error?.message || response.statusText}`);

      if (RETRYABLE_STATUS.has(response.status)) continue;
      throw lastError;
    }

    const text = result?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";

    if (!text) {
      lastError = new Error(`Gemini returned no content (${result?.candidates?.[0]?.finishReason || "unknown"}).`);
      continue;
    }

    return { data: JSON.parse(text) as T, model: result?.modelVersion || model };
  }

  throw lastError || new Error("Gemini request failed.");
}
