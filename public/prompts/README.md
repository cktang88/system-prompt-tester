# System Prompts Directory

This directory contains system prompts that will be automatically loaded when the application starts.

## File Format

Each prompt should be a `.txt` file with the following format:

```
# Prompt Name
System prompt content goes here...
```

- The first line should start with `#` followed by the prompt name
- The rest of the file contains the system prompt text

## Example Files

- `helpful-assistant.txt` - A general helpful assistant prompt
- `creative-writer.txt` - A creative writing assistant prompt
- `code-reviewer.txt` - A code review assistant prompt

## Manifest File

The `manifest.json` file lists all prompt files that should be loaded:

```json
{
  "files": ["helpful-assistant.txt", "creative-writer.txt", "code-reviewer.txt"]
}
```

## Adding New Prompts

1. Create a new `.txt` file in this directory
2. Follow the format above (# Name on first line, prompt content below)
3. Add the filename to `manifest.json`
4. Refresh the application to load the new prompt

## Export Feature

When you add prompts through the UI, use the "Export All Prompts" button to get the file content and manifest updates needed to save them permanently.
