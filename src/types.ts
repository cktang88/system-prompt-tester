export interface SystemPrompt {
  id: string;
  name: string;
  prompt: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  promptId: string;
  messages: Message[];
  isLoading: boolean;
}
