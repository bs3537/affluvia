import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  ExternalLink,
  Loader2,
  Shield,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  className?: string;
}

export function WebViewModal({ 
  isOpen, 
  onClose, 
  url, 
  title = "External Content",
  className 
}: WebViewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setCurrentUrl(url);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll when modal is closed
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, url]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Force refresh by updating the iframe key
    const iframe = document.getElementById('webview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const handleOpenExternal = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 300 
            }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[9999]",
              "h-[90vh] bg-gray-900 rounded-t-2xl",
              "shadow-2xl border-t border-gray-700",
              "flex flex-col",
              "md:left-64", // Account for sidebar on desktop
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                {/* Navigation Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-gray-700"
                    disabled={!canGoBack}
                    onClick={() => {/* Implement back navigation */}}
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-gray-700"
                    disabled={!canGoForward}
                    onClick={() => {/* Implement forward navigation */}}
                  >
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-gray-700"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 text-gray-400",
                      isLoading && "animate-spin"
                    )} />
                  </Button>
                </div>

                {/* URL Bar */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-full border border-gray-700 flex-1 max-w-md">
                  <Shield className="h-3 w-3 text-green-400" />
                  <Globe className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-400 truncate">{currentUrl}</span>
                </div>

                {/* Title */}
                <div className="hidden md:block">
                  <h3 className="text-sm font-medium text-white">{title}</h3>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-gray-700"
                  onClick={handleOpenExternal}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-red-900/20 hover:text-red-400"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative bg-white overflow-hidden">
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Loading content...</p>
                  </div>
                </div>
              )}

              {/* Iframe */}
              <iframe
                id="webview-iframe"
                src={currentUrl}
                className="w-full h-full border-0"
                title={title}
                onLoad={handleIframeLoad}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                style={{
                  colorScheme: 'dark light',
                  background: '#111827'
                }}
              />

              {/* Fallback Message */}
              <noscript>
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <div className="text-center p-6">
                    <Globe className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Unable to load content
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      The external content couldn't be loaded in this view.
                    </p>
                    <Button 
                      onClick={handleOpenExternal}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Open in Browser
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </noscript>
            </div>

            {/* Bottom Bar (Mobile) */}
            <div className="md:hidden border-t border-gray-700 p-2 bg-gray-800/50">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="text-xs text-gray-400"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenExternal}
                  className="text-xs text-gray-400"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open in Browser
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}