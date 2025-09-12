import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, X, Sparkles, ArrowUp, Paperclip, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { FileUploadChat } from "./file-upload-chat";

interface CompactAIChatProps {
  onClose?: () => void;
  className?: string;
}

export function CompactAIChat({ onClose, className = "" }: CompactAIChatProps) {
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

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Compact Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center shadow-md">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Affluvia Financial Assistant
            </h3>
            <p className="text-xs text-gray-400">Powered by AI • Always available</p>
            <p className="text-xs text-yellow-300 mt-1 max-w-md">
              ⚠️ AI can make mistakes. Content is for educational purposes only. Please consult a financial advisor before making financial decisions.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white hover:bg-gray-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {/* Welcome message */}
            <div className="flex items-start space-x-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-1">Financial Assistant</p>
                <div className="bg-gray-800 rounded-xl p-3 max-w-md">
                  <div className="text-white text-sm leading-relaxed">
                    <div className="mb-2">
                      <span className="text-base">👋</span> Hello {user?.fullName ? user.fullName.split(' ')[0] : 'there'}!
                    </div>
                    <div className="mb-3">
                      I'm your <strong className="text-purple-300">AI-powered financial assistant</strong> with access to your complete financial profile.
                    </div>
                    <div className="text-purple-200 text-xs">
                      <strong>What would you like to explore today?</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick action buttons */}
            {messages.length === 0 && (
              <div className="ml-10 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.slice(0, 3).map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickPrompt(prompt)}
                      className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-purple-700/30 hover:border-purple-500 hover:text-white transition-all text-xs h-7 px-2"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.slice(3).map((prompt, index) => (
                    <Button
                      key={index + 3}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickPrompt(prompt)}
                      className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-purple-700/30 hover:border-purple-500 hover:text-white transition-all text-xs h-7 px-2"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Chat messages */}
            {messages.map((msg: any) => (
              <div key={msg.id} className="space-y-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="flex items-start space-x-3 max-w-md">
                    <div className="flex-1 min-w-0">
                      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-3">
                        <p className="text-white text-sm break-words">{msg.message}</p>
                        {msg.hasDocuments && msg.documentNames && (
                          <div className="mt-2 pt-2 border-t border-purple-500/30">
                            <div className="flex items-center flex-wrap gap-1">
                              <FileText className="w-3 h-3 text-purple-200" />
                              <span className="text-xs text-purple-200">
                                {msg.documentNames.length} file{msg.documentNames.length !== 1 ? 's' : ''}:
                              </span>
                              {msg.documentNames.map((name: string, index: number) => (
                                <span key={index} className="text-xs text-purple-100 bg-purple-600/50 px-1 py-0.5 rounded">
                                  {name.length > 15 ? `${name.substring(0, 12)}...` : name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-right">You</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
                
                {/* AI response */}
                {msg.response && (
                  <>
                    <div className="flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-1">Financial Assistant</p>
                        <div className="bg-gray-800 rounded-xl p-3 max-w-2xl">
                          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.response}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Conversation starters after AI response */}
                    <div className="ml-10 mt-3 mb-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {quickPrompts.slice(0, 3).map((prompt, index) => (
                            <Button
                              key={`after-response-${msg.id}-${index}`}
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickPrompt(prompt)}
                              className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-purple-700/30 hover:border-purple-500 hover:text-white transition-all text-xs h-7 px-2"
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {quickPrompts.slice(3).map((prompt, index) => (
                            <Button
                              key={`after-response-${msg.id}-${index + 3}`}
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickPrompt(prompt)}
                              className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-purple-700/30 hover:border-purple-500 hover:text-white transition-all text-xs h-7 px-2"
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-start space-x-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1">Financial Assistant</p>
                  <div className="bg-gray-800 rounded-xl p-3">
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
      </div>
      
      {/* File Upload Interface */}
      {showFileUpload && (
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Upload Documents
            </h4>
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
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/30">
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
          
          <div className="flex-1 relative">
            <Input
              placeholder="Ask about your finances, goals, or get personalized advice..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-purple-500 focus-visible:border-purple-500 pr-12"
              disabled={isLoading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button 
                onClick={handleSendMessage}
                disabled={isLoading || !newMessage.trim()}
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg h-8 w-8 p-0"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>Press Enter to send • Shift+Enter for new line</span>
          <span className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>AI Online</span>
          </span>
        </div>
      </div>
    </div>
  );
}