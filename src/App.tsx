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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function App() {
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userInput, setUserInput] = useState("");
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<
    number | null
  >(null);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptText, setEditPromptText] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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

  // Helper function to get all unique user messages
  const getAllUserMessages = (): Message[] => {
    const userMessages: Message[] = [];
    if (conversations.length > 0) {
      const firstConversation = conversations[0];
      firstConversation.messages.forEach((message) => {
        if (message.role === "user") {
          userMessages.push(message);
        }
      });
    }
    return userMessages;
  };

  // Helper function to get the most recent assistant response for a prompt and message index
  const getMostRecentResponse = (
    promptId: string,
    messageIndex: number
  ): string | null => {
    const conversation = conversations.find((c) => c.promptId === promptId);
    if (!conversation) return null;

    // Find the assistant message that follows the user message at messageIndex
    const userMessageCount = conversation.messages.filter(
      (m) => m.role === "user"
    ).length;
    if (messageIndex >= userMessageCount) return null;

    // Find the assistant response that comes after the user message at messageIndex
    let userCount = 0;
    for (let i = 0; i < conversation.messages.length; i++) {
      const message = conversation.messages[i];
      if (message.role === "user") {
        if (userCount === messageIndex) {
          // Look for the next assistant message
          for (let j = i + 1; j < conversation.messages.length; j++) {
            if (conversation.messages[j].role === "assistant") {
              return conversation.messages[j].content;
            }
          }
          return null;
        }
        userCount++;
      }
    }
    return null;
  };

  // Edit prompt functions
  const openEditDialog = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setEditPromptName(prompt.name);
    setEditPromptText(prompt.prompt);
    setIsEditDialogOpen(true);
  };

  const saveEditedPrompt = () => {
    if (!editingPrompt || !editPromptName.trim() || !editPromptText.trim())
      return;

    const updatedPrompts = systemPrompts.map((p) =>
      p.id === editingPrompt.id
        ? { ...p, name: editPromptName.trim(), prompt: editPromptText.trim() }
        : p
    );

    setSystemPrompts(updatedPrompts);
    setIsEditDialogOpen(false);
    setEditingPrompt(null);
    setEditPromptName("");
    setEditPromptText("");
  };

  const cancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingPrompt(null);
    setEditPromptName("");
    setEditPromptText("");
  };

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

  const userMessages = getAllUserMessages();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">
            System Prompt Comparison Tool
          </h1>
          <div className="space-x-2">
            {systemPrompts.length > 0 && (
              <Button onClick={exportAllPrompts} variant="outline" size="sm">
                Export All Prompts
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 max-w-7xl mx-auto">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add System Prompt */}
      <div className="p-4 border-b bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Add System Prompt ({systemPrompts.length}/10)
              </CardTitle>
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
        </div>
      </div>

      {/* User Input */}
      {systemPrompts.length > 0 && (
        <div className="p-4 border-b bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Send Message to All Prompts
                </CardTitle>
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
                      !userInput.trim() ||
                      conversations.some((c) => c.isLoading)
                    }
                  >
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {systemPrompts.length > 0 ? (
        <div className="flex flex-1 min-h-0">
          {/* Left Sidebar - User Messages */}
          <div className="w-80 border-r bg-muted/20 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Your Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {userMessages.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No messages yet. Send a message to get started!
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {userMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMessageIndex === index
                          ? "bg-primary/10 border-primary"
                          : "bg-background hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedMessageIndex(index)}
                    >
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Message {index + 1}
                      </p>
                      <p className="text-sm line-clamp-3">{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - System Prompts and Responses */}
          <div className="flex-1 overflow-y-auto">
            {selectedMessageIndex !== null &&
            selectedMessageIndex < userMessages.length ? (
              <div className="p-4">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Responses to: "{userMessages[selectedMessageIndex].content}"
                  </h2>
                </div>
                <div className="space-y-4">
                  {systemPrompts.map((prompt) => {
                    const response = getMostRecentResponse(
                      prompt.id,
                      selectedMessageIndex
                    );
                    const conversation = conversations.find(
                      (c) => c.promptId === prompt.id
                    );
                    const isLoading = conversation?.isLoading || false;

                    return (
                      <Card key={prompt.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">
                              {prompt.name}
                            </CardTitle>
                            <div className="space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(prompt)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSystemPrompt(prompt.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {isLoading ? (
                            <div className="p-4 bg-yellow-100 text-yellow-900 rounded text-sm">
                              <strong>Assistant:</strong> Thinking...
                            </div>
                          ) : response ? (
                            <div className="p-4 bg-muted rounded text-sm">
                              <strong>Assistant:</strong> {response}
                            </div>
                          ) : (
                            <div className="p-4 bg-muted/50 rounded text-sm text-muted-foreground">
                              No response yet
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg">
                    Select a message from the left sidebar
                  </p>
                  <p className="text-sm">to see system prompt responses</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
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
        </div>
      )}

      {/* Edit Prompt Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit System Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <Input
                value={editPromptName}
                onChange={(e) => setEditPromptName(e.target.value)}
                placeholder="Prompt name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                System Prompt
              </label>
              <Textarea
                value={editPromptText}
                onChange={(e) => setEditPromptText(e.target.value)}
                placeholder="System prompt text"
                rows={8}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button onClick={saveEditedPrompt}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
