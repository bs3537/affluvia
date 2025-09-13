import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, 
  Send, 
  X, 
  User, 
  Bot, 
  MessageSquare,
  DollarSign,
  GraduationCap,
  PiggyBank,
  Target,
  TrendingUp,
  Calculator,
  AlertCircle,
  Book,
  Users,
  Settings,
  HelpCircle
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface EducationAIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  educationGoals: any[];
}

const SUGGESTED_QUESTIONS = [
  {
    icon: <DollarSign className="w-4 h-4" />,
    title: "Cost Analysis",
    question: "What are the total projected costs for my child's education including inflation?",
    category: "cost"
  },
  {
    icon: <PiggyBank className="w-4 h-4" />,
    title: "529 Plan Optimization",
    question: "How can I optimize my 529 plan contributions for maximum tax benefits?",
    category: "savings"
  },
  {
    icon: <Target className="w-4 h-4" />,
    title: "Funding Gap",
    question: "What's my current funding gap and how can I close it?",
    category: "planning"
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    title: "Investment Strategy",
    question: "What's the optimal investment strategy for my education savings timeline?",
    category: "investment"
  },
  {
    icon: <Calculator className="w-4 h-4" />,
    title: "Monthly Contributions",
    question: "How much should I contribute monthly to reach my education funding goals?",
    category: "contribution"
  },
  {
    icon: <AlertCircle className="w-4 h-4" />,
    title: "Risk Assessment",
    question: "What are the risks to my education funding plan and how can I mitigate them?",
    category: "risk"
  },
  {
    icon: <Book className="w-4 h-4" />,
    title: "College Selection",
    question: "How do different college choices impact my funding requirements?",
    category: "selection"
  },
  {
    icon: <Users className="w-4 h-4" />,
    title: "Family Planning",
    question: "How should I plan for multiple children's education expenses?",
    category: "family"
  },
  {
    icon: <Settings className="w-4 h-4" />,
    title: "Plan Adjustments",
    question: "When should I adjust my education funding strategy?",
    category: "adjustment"
  }
];

export function EducationAIChatbot({ 
  isOpen, 
  onClose, 
  educationGoals 
}: EducationAIChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || inputValue.trim();
    if (!content) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/education/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          educationGoals,
          chatHistory: messages
        })
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I apologize, but I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredSuggestions = selectedCategory
    ? SUGGESTED_QUESTIONS.filter(q => q.category === selectedCategory)
    : SUGGESTED_QUESTIONS;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end">
      <div className="w-full max-w-md h-full bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Affluvia AI</h2>
                <p className="text-xs text-gray-400">Your AI Financial Planning Assistant</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 flex-shrink-0">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-900/30 rounded-full mb-3">
                    <GraduationCap className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    What can Affluvia AI help you with?
                  </h3>
                  <p className="text-sm text-gray-400">
                    I can help analyze your education funding strategy, optimize your 529 plans, and answer questions about your specific situation.
                  </p>
                </div>

                <div className="mb-4">
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <Button
                      variant={selectedCategory === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      className={`text-xs ${
                        selectedCategory === null 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600'
                      }`}
                    >
                      All
                    </Button>
                    <Button
                      variant={selectedCategory === "cost" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory("cost")}
                      className={`text-xs ${
                        selectedCategory === "cost" 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600'
                      }`}
                    >
                      Cost
                    </Button>
                    <Button
                      variant={selectedCategory === "savings" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory("savings")}
                      className={`text-xs ${
                        selectedCategory === "savings" 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600'
                      }`}
                    >
                      Savings
                    </Button>
                    <Button
                      variant={selectedCategory === "planning" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory("planning")}
                      className={`text-xs ${
                        selectedCategory === "planning" 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600'
                      }`}
                    >
                      Planning
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 px-4">
                <div className="space-y-2 pb-4">
                  {filteredSuggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto p-3 bg-gray-800/50 hover:bg-gray-800 text-white"
                      onClick={() => handleSendMessage(suggestion.question)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5 text-blue-400">
                          {suggestion.icon}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{suggestion.title}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {suggestion.question}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex gap-2 max-w-[85%] ${
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {message.role === "user" ? (
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                            <Bot className="w-4 h-4 text-blue-400" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-100"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <p className="text-xs mt-1 opacity-70">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your education funding..."
              className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Affluvia AI can make mistakes. Double-check important information.
          </p>
        </div>
      </div>
    </div>
  );
}