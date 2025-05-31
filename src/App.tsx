import { useState, useEffect } from "react";
import type { SystemPrompt, Conversation, Message } from "./types";
import { callOpenAI } from "./openai";
import {
  loadPromptsFromDirectory,
  generatePromptFileContent,
  generateManifestContent,
} from "./promptManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function App() {
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userInput, setUserInput] = useState("");
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load prompts from directory on startup
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const prompts = await loadPromptsFromDirectory();
        setSystemPrompts(prompts);
        setConversations(
          prompts.map((prompt) => ({
            promptId: prompt.id,
            messages: [],
            isLoading: false,
          }))
        );
      } catch (error) {
        console.error("Failed to load prompts:", error);
        setError("Failed to load prompts from directory");
      } finally {
        setIsLoading(false);
      }
    };

    loadPrompts();
  }, []);

  const addSystemPrompt = () => {
    if (!newPromptName.trim() || !newPromptText.trim()) return;
    if (systemPrompts.length >= 10) {
      setError("Maximum 10 system prompts allowed");
      return;
    }

    const newPrompt: SystemPrompt = {
      id: Date.now().toString(),
      name: newPromptName.trim(),
      prompt: newPromptText.trim(),
    };

    setSystemPrompts([...systemPrompts, newPrompt]);
    setConversations([
      ...conversations,
      {
        promptId: newPrompt.id,
        messages: [],
        isLoading: false,
      },
    ]);
    setNewPromptName("");
    setNewPromptText("");
    setError(null);

    // Show instructions for saving the prompt
    const filename = `${newPrompt.id}.txt`;
    const content = generatePromptFileContent(newPrompt);
    console.log(
      `\n📁 To save this prompt permanently, create: public/prompts/${filename}`
    );
    console.log("📄 Content:");
    console.log(content);
    console.log(
      "\n📋 Then update public/prompts/manifest.json to include:",
      filename
    );
  };

  const removeSystemPrompt = (id: string) => {
    setSystemPrompts(systemPrompts.filter((p) => p.id !== id));
    setConversations(conversations.filter((c) => c.promptId !== id));
  };

  const exportAllPrompts = () => {
    console.log("\n🗂️  EXPORT ALL PROMPTS");
    console.log("=".repeat(50));

    systemPrompts.forEach((prompt) => {
      const filename = `${prompt.id}.txt`;
      const content = generatePromptFileContent(prompt);
      console.log(`\n📁 File: public/prompts/${filename}`);
      console.log("📄 Content:");
      console.log(content);
      console.log("-".repeat(30));
    });

    const allFilenames = systemPrompts.map((p) => `${p.id}.txt`);
    const manifestContent = generateManifestContent(allFilenames);
    console.log("\n📋 Update public/prompts/manifest.json:");
    console.log(manifestContent);
    console.log("\n✅ Copy the above content to save all prompts permanently!");
  };

  const sendMessage = async () => {
    if (!userInput.trim()) return;
    if (systemPrompts.length === 0) {
      setError("Add at least one system prompt first");
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: userInput.trim(),
    };

    // Add user message to all conversations
    setConversations((prevConversations) =>
      prevConversations.map((conv) => ({
        ...conv,
        messages: [...conv.messages, userMessage],
        isLoading: true,
      }))
    );

    setUserInput("");
    setError(null);

    // Call OpenAI for each system prompt
    const promises = systemPrompts.map(async (prompt) => {
      try {
        const conversation = conversations.find(
          (c) => c.promptId === prompt.id
        );
        const messages = conversation
          ? [...conversation.messages, userMessage]
          : [userMessage];

        const response = await callOpenAI(prompt.prompt, messages);

        return {
          promptId: prompt.id,
          response,
          error: null,
        };
      } catch (error) {
        return {
          promptId: prompt.id,
          response: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const results = await Promise.all(promises);

    // Update conversations with responses
    setConversations((prevConversations) =>
      prevConversations.map((conv) => {
        const result = results.find((r) => r.promptId === conv.promptId);
        if (!result) return { ...conv, isLoading: false };

        const assistantMessage: Message = {
          role: "assistant",
          content: result.error || result.response || "No response",
        };

        return {
          ...conv,
          messages: [...conv.messages, assistantMessage],
          isLoading: false,
        };
      })
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Loading prompts from directory...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">
            System Prompt Comparison Tool
          </h1>
          {systemPrompts.length > 0 && (
            <Button onClick={exportAllPrompts} variant="outline">
              Export All Prompts
            </Button>
          )}
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Add System Prompt */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add System Prompt ({systemPrompts.length}/10)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={newPromptName}
              onChange={(e) => setNewPromptName(e.target.value)}
              placeholder="Prompt name"
            />
            <Textarea
              value={newPromptText}
              onChange={(e) => setNewPromptText(e.target.value)}
              placeholder="System prompt text"
              rows={3}
            />
            <Button
              onClick={addSystemPrompt}
              disabled={systemPrompts.length >= 10}
            >
              Add Prompt
            </Button>
          </CardContent>
        </Card>

        {/* User Input */}
        {systemPrompts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Send Message to All Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your message here..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                />
                <Button
                  onClick={sendMessage}
                  disabled={
                    !userInput.trim() || conversations.some((c) => c.isLoading)
                  }
                >
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversations Grid */}
        {systemPrompts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemPrompts.map((prompt) => {
              const conversation = conversations.find(
                (c) => c.promptId === prompt.id
              );
              return (
                <Card key={prompt.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{prompt.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSystemPrompt(prompt.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="p-2 bg-muted rounded text-sm text-muted-foreground">
                      <strong>System:</strong> {prompt.prompt}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {conversation?.messages.map((message, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded text-sm ${
                            message.role === "user"
                              ? "bg-primary/10 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <strong>
                            {message.role === "user" ? "You" : "Assistant"}:
                          </strong>{" "}
                          {message.content}
                        </div>
                      ))}
                      {conversation?.isLoading && (
                        <div className="p-2 bg-yellow-100 text-yellow-900 rounded text-sm">
                          <strong>Assistant:</strong> Thinking...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {systemPrompts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {isLoading
                ? "Loading prompts..."
                : "No prompts found in /prompts directory"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Add prompts to <code>public/prompts/</code> and update{" "}
              <code>manifest.json</code>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Or add a new prompt above to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
