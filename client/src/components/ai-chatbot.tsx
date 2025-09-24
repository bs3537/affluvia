import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Upload, ArrowLeft, X, PlusCircle } from "lucide-react";

interface AIChatbotProps {
  onClose?: () => void;
}

export function AIChatbot({ onClose }: AIChatbotProps) {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load chat messages on component mount
  useEffect(() => {
    loadChatMessages();
  }, []);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Seconds timer while analyzing
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isLoading) {
      setElapsedSec(0);
      timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const loadChatMessages = async () => {
    try {
      const response = await fetch('/api/chat-messages', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      setIsLoading(true);
      const messageText = newMessage;
      setNewMessage("");
      
      try {
        const response = await fetch('/api/chat-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ message: messageText }),
        });
        
        if (response.ok) {
          const newChatMessage = await response.json();
          setMessages(prev => [...prev, newChatMessage]);
        } else {
          throw new Error('Failed to send message');
        }
      } catch (error) {
        console.error('Error sending message:', error);
        // Add error message to chat
        const errorMessage = {
          id: Date.now(),
          message: messageText,
          response: "I'm sorry, I'm having trouble connecting to the AI service right now. Please try again later."
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const quickPrompts = [
    "Analyze my financial health",
    "What's my retirement readiness?",
    "How can I reduce taxes?",
    "Review my investment allocation",
    "Emergency fund recommendations"
  ];

  const handleQuickPrompt = (prompt: string) => {
    setNewMessage(prompt);
  };

  const onNewChat = () => {
    // Clear UI-only; persisted chat remains in DB
    setMessages([]);
    setNewMessage("");
    setElapsedSec(0);
  };

  const onClickUpload = () => fileInputRef.current?.click();

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append('documents', f));
      if (newMessage.trim()) form.append('message', newMessage.trim());

      const res = await fetch('/api/chat-messages/upload', {
        method: 'POST',
        body: form,
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Upload failed');
      const payload = await res.json();
      if (payload?.message) {
        setMessages((prev) => [...prev, payload.message]);
        setNewMessage("");
      }
    } catch (err) {
      console.error('Upload error:', err);
      setMessages((prev) => [...prev, { id: Date.now(), message: 'Uploaded document(s)', response: 'Sorry, I could not analyze the document(s) right now.' }]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      <div className="flex-1 flex flex-col h-full w-full">
        {/* Header with navigation */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white">Affluvia Financial Assistant</h2>
              <p className="text-sm text-gray-400">Ask me anything about your financial plan</p>
              <p className="text-xs text-yellow-300 mt-1 max-w-md">
                ⚠️ AI can make mistakes. Content is for educational purposes only. Please consult a financial advisor before making financial decisions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onNewChat}
              className="bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-500"
              title="Start a new chat (clears current view)"
            >
              <PlusCircle className="w-4 h-4 mr-2" /> New Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Chat content area */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <Card className="card-gradient border-gray-700 flex-1 mb-4 min-h-0">
            <CardContent className="p-4 h-full">
              <ScrollArea className="h-full pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="spinner" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Initial AI message */}
                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-full bg-[#8A00C4] flex items-center justify-center mr-3">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-400 mb-1">Financial Assistant</p>
                        <div className="bg-gray-800 rounded-lg p-3 inline-block max-w-4xl">
                          <p className="text-white break-words whitespace-pre-wrap leading-relaxed">
                            Hello! I'm your AI financial assistant. I can help you understand your financial situation, 
                            explain recommendations, and answer questions about your financial plan. What would you like to know?
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Initial quick prompts */}
                    {messages.length === 0 && (
                      <div className="flex flex-wrap gap-2 ml-11 mt-3">
                        {quickPrompts.map((prompt, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickPrompt(prompt)}
                            className="bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-purple-700/30 hover:border-purple-500 hover:text-white transition-all text-xs"
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    {/* Chat messages */}
                    {messages.map((msg: any) => (
                      <div key={msg.id}>
                        {/* User message */}
                        <div className="flex items-start justify-end mb-4">
                          <div className="flex-1 text-right">
                            <p className="text-sm text-gray-400 mb-1">You</p>
                            <div className="bg-[#8A00C4] rounded-lg p-3 inline-block max-w-xl">
                              <p className="text-white break-words whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center ml-3">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        
                        {/* AI response */}
                        {msg.response && (
                          <>
                            <div className="flex items-start">
                              <div className="w-8 h-8 rounded-full bg-[#8A00C4] flex items-center justify-center mr-3">
                                <Bot className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-400 mb-1">Financial Assistant</p>
                                <div className="bg-gray-800 rounded-lg p-3 inline-block max-w-4xl">
                                  <p className="text-white break-words whitespace-pre-wrap leading-relaxed">{msg.response}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Conversation starters after AI response */}
                            <div className="flex flex-wrap gap-2 ml-11 mt-3 mb-4">
                              {quickPrompts.map((prompt, index) => (
                                <Button
                                  key={`after-response-${msg.id}-${index}`}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickPrompt(prompt)}
                                  className="bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-purple-700/30 hover:border-purple-500 hover:text-white transition-all text-xs"
                                >
                                  {prompt}
                                </Button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    
                    {/* Loading state for sending message */}
                    {isLoading && (
                      <div className="flex items-start">
                        <div className="w-8 h-8 rounded-full bg-[#8A00C4] flex items-center justify-center mr-3">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-1">Financial Assistant</p>
                          <div className="bg-gray-800 rounded-lg p-3 inline-block">
                            <div className="flex items-center">
                              <div className="spinner mr-2" />
                              <p className="text-white">Analyzing your financial data… {elapsedSec}s</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Invisible element to scroll to */}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* Message input */}
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Type your question here..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 bg-gray-800 border-gray-700 text-white focus:border-primary"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={isLoading || !newMessage.trim()}
              className="bg-[#8A00C4] hover:bg-[#a020f0] text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="mt-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept="application/pdf,image/*,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFilesSelected}
            />
            <Button
              variant="link"
              className="text-primary hover:underline text-sm"
              onClick={onClickUpload}
              disabled={isUploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading…' : 'Upload document for analysis'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
