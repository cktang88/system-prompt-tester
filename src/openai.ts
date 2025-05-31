import type { Message } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

let cachedApiKey: string | null = null;

export async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  try {
    const response = await fetch("/api-key.txt");
    if (!response.ok) {
      throw new Error("API key file not found");
    }
    const apiKey = (await response.text()).trim();
    if (!apiKey || apiKey === "your-openai-api-key-here") {
      throw new Error("Please add your OpenAI API key to api-key.txt");
    }
    cachedApiKey = apiKey;
    return apiKey;
  } catch {
    throw new Error(
      "Failed to load API key from file. Make sure api-key.txt exists in the public folder with your OpenAI API key."
    );
  }
}

export async function callOpenAI(
  systemPrompt: string,
  messages: Message[]
): Promise<string> {
  const apiKey = await getApiKey();

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API error: ${response.statusText} - ${
        errorData.error?.message || "Unknown error"
      }`
    );
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "No response";
}
