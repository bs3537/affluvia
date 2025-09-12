import React, { useState } from 'react';
import { X, ExternalLink, Globe, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Allowed sites for embedding
const ALLOW_EMBED = new Set<string>([
  'money.usnews.com',
  'www.nerdwallet.com',
  'www.creditkarma.com',
  'www.bankrate.com',
  'studentaid.gov',
  'www.investopedia.com',
  'www.vanguard.com',
  'www.fidelity.com',
  'www.schwab.com',
  'www.etrade.com',
  // Add more trusted financial sites as needed
]);

interface InAppBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  className?: string;
}

export function InAppBrowser({
  isOpen,
  onClose,
  url,
  title = "External Content",
  className
}: InAppBrowserProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset states when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setHasError(false);
      // Set a timeout to detect if iframe doesn't load
      const timeout = setTimeout(() => {
        if (isLoading) {
          setHasError(true);
          setIsLoading(false);
        }
      }, 5000); // 5 second timeout
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Check if URL is allowed for embedding
  const urlObj = new URL(url);
  const isAllowed = ALLOW_EMBED.has(urlObj.host);

  // For local development, always show the fallback UI
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  // If not allowed, open in new tab instead
  if (!isAllowed && isOpen) {
    handleOpenExternal();
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "w-full max-w-7xl h-[90vh] bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-700",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-green-600/20 rounded-lg">
                  <Globe className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="text-xs text-gray-400 truncate max-w-md">{urlObj.host}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 rounded-lg border border-green-500/30">
                  <Shield className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400">Secure</span>
                </div>
                
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400 hover:text-white" />
                </a>
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            {(isLocalDev || hasError) ? (
              // Fallback UI for local development or when iframe fails
              <div className="flex-1 bg-gray-900 flex items-center justify-center">
                <div className="max-w-md text-center space-y-6 p-8">
                  <div className="mx-auto w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center">
                    <Globe className="w-10 h-10 text-green-400" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-white">
                      External Site Preview Not Available
                    </h3>
                    <p className="text-gray-400">
                      This site cannot be embedded due to security restrictions.
                    </p>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-300 mb-3">
                      You're trying to access:
                    </p>
                    <p className="text-sm font-mono text-green-400 break-all">
                      {url}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleOpenExternal}
                      className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </button>
                    
                    <button
                      onClick={onClose}
                      className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors border border-gray-600"
                    >
                      Close
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Shield className="w-3 h-3" />
                    <span>External sites open in a secure new tab</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Loading indicator */}
                {isLoading && (
                  <div className="absolute inset-0 top-14 bg-gray-900 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin" />
                      <p className="text-gray-400">Loading content...</p>
                    </div>
                  </div>
                )}

                {/* Iframe */}
                <iframe
                  src={url}
                  title={title}
                  className="flex-1 bg-white"
                  onLoad={() => {
                    setIsLoading(false);
                    setHasError(false);
                  }}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                  // Security: Tighten sandbox but allow necessary features for financial sites
                  sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}