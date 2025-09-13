import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, ArrowLeft, X, Minimize2, Maximize2, Sparkles, Paperclip, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { FileUploadChat } from "./file-upload-chat";

interface EnhancedAIChatProps {
  onClose?: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  className?: string;
}

export function EnhancedAIChat({ onClose, onMinimize, isMinimized = false, className = "" }: EnhancedAIChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  
  // Load chat messages on component mount
  useEffect(() => {
    loadChatMessages();
  }, []);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const loadChatMessages = async () => {
    try {
      const response = await fetch('/api/chat-messages');
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
      setIsTyping(true);
      const messageText = newMessage;
      setNewMessage("");
      
      // Add user message immediately for better UX
      const userMessage = {
        id: `temp-${Date.now()}`,
        message: messageText,
        response: null,
        isTemporary: true
      };
      setMessages(prev => [...prev, userMessage]);
      
      try {
        const response = await fetch('/api/chat-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: messageText }),
        });
        
        if (response.ok) {
          const newChatMessage = await response.json();
          // Replace temporary message with real one
          setMessages(prev => prev.filter(msg => msg.id !== userMessage.id).concat(newChatMessage));
        } else {
          throw new Error('Failed to send message');
        }
      } catch (error) {
        console.error('Error sending message:', error);
        // Update temporary message with error
        const errorMessage = {
          ...userMessage,
          response: "I'm sorry, I'm having trouble connecting right now. Please try again later.",
          isTemporary: false
        };
        setMessages(prev => prev.map(msg => msg.id === userMessage.id ? errorMessage : msg));
      } finally {
        setIsLoading(false);
        setIsTyping(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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

  const handleFilesUpload = async (files: File[], message?: string) => {
    if (files.length === 0) return;

    setIsLoading(true);
    setIsTyping(true);
    setShowFileUpload(false);

    // Create FormData for file upload
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('documents', file);
    });
    if (message) {
      formData.append('message', message);
    }

    // Add user message immediately for better UX
    const userMessage = {
      id: `temp-${Date.now()}`,
      message: message || `Uploaded ${files.length} document(s): ${files.map(f => f.name).join(', ')}`,
      response: null,
      isTemporary: true,
      hasDocuments: true,
      documentNames: files.map(f => f.name)
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/chat-messages/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        // Replace temporary message with real one
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id).concat(result.message));
      } else {
        throw new Error('Failed to upload files');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      // Update temporary message with error
      const errorMessage = {
        ...userMessage,
        response: "I'm sorry, I'm having trouble processing your documents right now. Please try again later.",
        isTemporary: false
      };
      setMessages(prev => prev.map(msg => msg.id === userMessage.id ? errorMessage : msg));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  if (isMinimized) {
    return (
      <div className={`bg-gray-800 border border-gray-600 rounded-lg shadow-xl ${className}`}>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-medium text-white">Financial Assistant</span>
                <div className="text-xs text-gray-400">Ready to help</div>
              </div>
            </div>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMinimize && onMinimize()}
                className="w-6 h-6 p-0 text-gray-400 hover:text-white"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="w-6 h-6 p-0 text-gray-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-300 mt-2">
            I'm here to help with your financial questions. Click to expand!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 bg-gray-900 flex flex-col ${className}`}>
      <div className="flex-1 flex flex-col h-full w-full">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800/50 to-purple-900/20">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Affluvia Financial Assistant
                </h2>
                <p className="text-sm text-gray-400">Powered by AI • Always available</p>
                <p className="text-xs text-yellow-300 mt-1 max-w-md">
                  ⚠️ AI can make mistakes. Content is for educational purposes only. Please consult a financial advisor before making financial decisions.
                </p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            {onMinimize && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMinimize}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            )}
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
          <Card className="bg-gray-800/30 backdrop-blur-sm border-gray-700 flex-1 mb-4 min-h-0">
            <CardContent className="p-4 h-full">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {/* Welcome message */}
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center mr-3 shadow-md">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-400 mb-1">Financial Assistant</p>
                      <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-4 inline-block max-w-4xl border border-gray-600/30">
                        <div className="text-white break-words whitespace-pre-wrap leading-relaxed">
                          <div className="mb-4">
                            <span className="text-xl">👋</span> Hello {user?.name ? user.name.split(' ')[0] : 'there'}! 
                          </div>
                          
                          <div className="mb-4">
                            I'm your <strong className="text-purple-300">AI-powered financial assistant</strong> with access to your complete financial profile. I can provide personalized insights on:
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2 mb-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">💰</span> Investment recommendations & portfolio analysis
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400">🎯</span> Retirement planning & Monte Carlo analysis
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-400">📊</span> Tax reduction strategies & optimization
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-red-400">🛡️</span> Emergency fund & risk management
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-purple-400">🎓</span> Education planning & goal tracking
                            </div>
                          </div>
                          
                          <div className="text-purple-200">
                            <strong>What would you like to explore today?</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick action prompts - Show initially when no messages */}
                  {messages.length === 0 && (
                    <div className="flex flex-wrap gap-2 ml-11">
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
                          <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-3 inline-block max-w-xl shadow-md">
                            <p className="text-white break-words whitespace-pre-wrap">{msg.message}</p>
                            {msg.hasDocuments && msg.documentNames && (
                              <div className="mt-2 pt-2 border-t border-purple-500/30">
                                <div className="flex items-center flex-wrap gap-1">
                                  <FileText className="w-3 h-3 text-purple-200" />
                                  <span className="text-xs text-purple-200">
                                    {msg.documentNames.length} file{msg.documentNames.length !== 1 ? 's' : ''}:
                                  </span>
                                  {msg.documentNames.map((name: string, index: number) => (
                                    <span key={index} className="text-xs text-purple-100 bg-purple-600/50 px-1 py-0.5 rounded">
                                      {name.length > 20 ? `${name.substring(0, 17)}...` : name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
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
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center mr-3 shadow-md">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-400 mb-1">Financial Assistant</p>
                              <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-3 inline-block max-w-4xl border border-gray-600/30">
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
                  
                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center mr-3 shadow-md">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-400 mb-1">Financial Assistant</p>
                        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-3 inline-block border border-gray-600/30">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <p className="text-white text-sm">Analyzing your financial data...</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* File Upload Interface */}
          {showFileUpload && (
            <Card className="bg-gray-800/30 backdrop-blur-sm border-gray-700 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Upload Documents
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFileUpload(false)}
                    className="text-gray-400 hover:text-white h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <FileUploadChat
                  onFilesUploaded={handleFilesUpload}
                  disabled={isLoading}
                  maxFiles={5}
                  maxFileSize={25}
                />
              </CardContent>
            </Card>
          )}

          {/* Enhanced message input */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <div className="flex items-end space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFileUpload(!showFileUpload)}
                disabled={isLoading}
                className={`h-10 w-10 p-0 flex-shrink-0 transition-all ${
                  showFileUpload 
                    ? 'text-purple-400 bg-purple-900/30 hover:bg-purple-900/50' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                title="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              
              <div className="flex-1">
                <Input
                  placeholder="Ask about your finances, goals, or get personalized advice..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-transparent border-none text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[40px]"
                  disabled={isLoading}
                />
              </div>
              <Button 
                onClick={handleSendMessage}
                disabled={isLoading || !newMessage.trim()}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg h-10 px-4"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                <span>Press Enter to send • Shift+Enter for new line</span>
                {!showFileUpload && (
                  <button
                    onClick={() => setShowFileUpload(true)}
                    className="text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Attach files</span>
                  </button>
                )}
              </div>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>AI Online</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}