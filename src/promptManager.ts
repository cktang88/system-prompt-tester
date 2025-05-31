import type { SystemPrompt } from "./types";

const PROMPTS_BASE_URL = "/prompts";

export async function loadPromptsFromDirectory(): Promise<SystemPrompt[]> {
  try {
    // Try to get the list of prompt files from a manifest
    const manifestResponse = await fetch(`${PROMPTS_BASE_URL}/manifest.json`);

    if (!manifestResponse.ok) {
      // If no manifest, return empty array
      return [];
    }

    const manifest: { files: string[] } = await manifestResponse.json();
    const prompts: SystemPrompt[] = [];

    for (const filename of manifest.files) {
      if (filename.endsWith(".txt")) {
        try {
          const response = await fetch(`${PROMPTS_BASE_URL}/${filename}`);
          if (response.ok) {
            const content = await response.text();
            const lines = content.split("\n");
            const name =
              lines[0]?.replace(/^#\s*/, "") || filename.replace(".txt", "");
            const prompt = lines.slice(1).join("\n").trim();

            if (prompt) {
              prompts.push({
                id: filename.replace(".txt", ""),
                name,
                prompt,
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to load prompt from ${filename}:`, error);
        }
      }
    }

    return prompts;
  } catch (error) {
    console.warn("Failed to load prompts from directory:", error);
    return [];
  }
}

export async function savePromptToDirectory(
  prompt: SystemPrompt
): Promise<void> {
  // This would typically require a backend API to write files
  // For now, we'll just log instructions for manual file creation
  const filename = `${prompt.id}.txt`;
  const content = `# ${prompt.name}\n${prompt.prompt}`;

  console.log(
    `To save this prompt, create a file at public/prompts/${filename} with content:`
  );
  console.log(content);
  console.log(
    "\nAlso update public/prompts/manifest.json to include this file."
  );
}

export function generatePromptFileContent(prompt: SystemPrompt): string {
  return `# ${prompt.name}\n${prompt.prompt}`;
}

export function generateManifestContent(filenames: string[]): string {
  return JSON.stringify({ files: filenames }, null, 2);
}
