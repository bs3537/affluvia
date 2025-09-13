import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu } from "lucide-react";
import { CompactAIChat } from "./compact-ai-chat";
import { Sidebar } from "./sidebar";

interface AIChatLayoutProps {
  onClose?: () => void;
  activeView: string;
  setActiveView: (view: any) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function AIChatLayout({ 
  onClose, 
  activeView, 
  setActiveView, 
  sidebarOpen, 
  setSidebarOpen 
}: AIChatLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile header */}
      <header className="lg:hidden bg-gray-800 border-b border-gray-700 p-4 absolute top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-white"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-semibold text-white">AFFLUVIA</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="h-full max-w-4xl mx-auto">
          <CompactAIChat onClose={onClose} className="h-full" />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}