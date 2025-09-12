import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  X, 
  ExternalLink,
  Globe,
  Shield,
  ArrowRight,
  CreditCard,
  Sparkles,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExternalLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  description?: string;
  className?: string;
  debtData?: {
    totalCreditCardDebt: number;
    potentialSavings: number;
    avgCreditCardRate: number;
  };
}

export function ExternalLinkModal({ 
  isOpen, 
  onClose, 
  url, 
  title = "External Content",
  description = "You're about to visit an external website",
  className,
  debtData
}: ExternalLinkModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll when modal is closed
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    // Optionally close the modal after opening
    setTimeout(() => onClose(), 500);
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
              "h-[85vh] bg-gray-900 rounded-t-2xl",
              "shadow-2xl border-t border-gray-700",
              "flex flex-col",
              "md:left-64", // Account for sidebar on desktop
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-600/20 rounded-lg">
                    <CreditCard className="h-5 w-5 text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">{title}</h2>
                </div>
                <p className="text-sm text-gray-400">{description}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-red-900/20 hover:text-red-400"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Preview Card */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <Globe className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-2">US News Money - Credit Cards</h3>
                    <p className="text-sm text-gray-400 mb-3">
                      Compare and find the best 0% balance transfer credit cards with expert reviews and recommendations.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-green-400">
                      <Shield className="h-3 w-3" />
                      <span>Secure & Trusted Source</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* What You'll Find Section */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-400" />
                    What You'll Find
                  </h3>
                  <div className="grid gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-white">Top Balance Transfer Cards</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Curated list of cards with 0% APR periods from 12-21 months
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-white">Expert Reviews & Ratings</p>
                          <p className="text-xs text-gray-400 mt-1">
                            In-depth analysis and scoring of each card's features
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-purple-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-white">Fee Comparisons</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Balance transfer fees, annual fees, and other costs
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-white">Application Process</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Pre-qualification tools with no impact on credit score
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Your Current Situation */}
                <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-500/30">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Based on Your Profile
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Current high-interest debt</span>
                      <span className="text-sm font-semibold text-white">
                        ${debtData?.totalCreditCardDebt ? debtData.totalCreditCardDebt.toFixed(0) : '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Potential interest savings</span>
                      <span className="text-sm font-semibold text-green-400">
                        ${debtData?.potentialSavings ? debtData.potentialSavings.toFixed(0) : '0'}/year
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Recommended 0% period</span>
                      <span className="text-sm font-semibold text-blue-400">
                        15-18 months
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white mb-1">
                        Secure External Site
                      </p>
                      <p className="text-xs text-gray-400">
                        You'll be redirected to US News Money, a trusted financial resource. 
                        Your Affluvia data remains private and is not shared.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="border-t border-gray-700 p-6 bg-gray-800/50">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={handleOpenExternal}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  Continue to US News
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
              <p className="text-xs text-center text-gray-500 mt-3">
                Opens in a new tab • You can return to Affluvia anytime
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}