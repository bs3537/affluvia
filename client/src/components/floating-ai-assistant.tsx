import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, MessageCircle, X, Minimize2 } from "lucide-react";
import { AIChatbot } from "./ai-chatbot";

interface FloatingAIAssistantProps {
  onOpenChat?: () => void;
}

export function FloatingAIAssistant({ onOpenChat }: FloatingAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggle = () => {
    if (onOpenChat) {
      // Use parent's chat handler (integrated with sidebar)
      onOpenChat();
    } else {
      // Use internal state for standalone mode
      setIsOpen(!isOpen);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  // Only show internal chat if no external handler is provided
  if (isOpen && !isMinimized && !onOpenChat) {
    return (
      <div className="fixed inset-0 z-50">
        <AIChatbot onClose={handleClose} />
      </div>
    );
  }

  return (
    <>
      {/* Floating Button */}
      <div className="fixed right-6 z-30 flex flex-col items-center animate-in slide-in-from-bottom-4 duration-500 bottom-24 sm:bottom-8 md:bottom-6">
        <div className="relative">
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggle();
            }}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-2 border-purple-400/30 group"
            size="icon"
            aria-label="Open Financial Assistant"
          >
            <div className="relative">
              <Bot className="w-7 h-7 text-white group-hover:scale-110 transition-transform duration-200" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </Button>
          
          {/* Pulsing glow effect */}
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-purple-600/20 animate-ping pointer-events-none" aria-hidden="true"></div>
        </div>
        
        {/* Enhanced title below the icon */}
        <div className="mt-3 text-center animate-in fade-in duration-700 delay-300">
          <div className="relative">
            <span className="text-xs font-semibold text-white bg-gradient-to-r from-gray-800/90 to-gray-700/90 px-3 py-2 rounded-full backdrop-blur-sm border border-gray-600/30 shadow-lg">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Financial Assistant
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Minimized Chat Window */}
      {isMinimized && (
        <div className="fixed bottom-36 sm:bottom-28 md:bottom-24 right-6 z-40 animate-in slide-in-from-right-4 duration-300">
          <div className="bg-gradient-to-r from-gray-800/95 to-gray-700/95 border border-gray-600/50 rounded-xl shadow-2xl backdrop-blur-sm p-4 w-80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center shadow-md">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800 animate-pulse"></div>
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">Financial Assistant</span>
                  <div className="text-xs text-gray-400">AI-Powered • Online</div>
                </div>
              </div>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(false)}
                  className="w-7 h-7 p-0 text-gray-400 hover:text-white hover:bg-purple-600/20 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="w-7 h-7 p-0 text-gray-400 hover:text-white hover:bg-red-500/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              💡 Ready to provide personalized financial insights and recommendations based on your complete financial profile.
            </p>
            <div className="mt-3 flex items-center text-xs text-purple-400">
              <span className="w-2 h-2 bg-purple-400 rounded-full mr-2 animate-pulse"></span>
              Click to expand and start chatting
            </div>
          </div>
        </div>
      )}
    </>
  );
}
