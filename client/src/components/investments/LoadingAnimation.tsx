import { motion } from "framer-motion";
import { Brain, ChartBar, TrendingUp, Sparkles } from "lucide-react";

interface LoadingAnimationProps {
  loadingSeconds: number;
  category: string;
}

export function LoadingAnimation({ loadingSeconds, category }: LoadingAnimationProps) {
  const messages = [
    "Scanning market data...",
    "Analyzing financial metrics...",
    "Evaluating growth patterns...",
    "Identifying top performers...",
    "Finalizing recommendations..."
  ];

  const currentMessage = messages[Math.min(Math.floor(loadingSeconds / 2), messages.length - 1)];

  const categoryIcons = {
    market: <ChartBar className="h-8 w-8" />,
    ai_infra: <Brain className="h-8 w-8" />,
    ai_software: <Sparkles className="h-8 w-8" />,
    cloud_saas: <TrendingUp className="h-8 w-8" />,
    cybersec: <Brain className="h-8 w-8" />
  };

  const categoryNames = {
    market: "Market Outlook",
    ai_infra: "AI Infrastructure",
    ai_software: "AI Software",
    cloud_saas: "Cloud & SaaS",
    cybersec: "Cybersecurity"
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 w-24 h-24"
        />
        
        {/* Inner pulsing circle */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative w-24 h-24 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center"
        >
          <div className="text-purple-600 dark:text-purple-300">
            {categoryIcons[category as keyof typeof categoryIcons] || <ChartBar className="h-8 w-8" />}
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Analyzing {categoryNames[category as keyof typeof categoryNames] || "Investment"} Data
        </h3>
        
        <motion.p
          key={currentMessage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-sm text-gray-600 dark:text-gray-400 mb-4"
        >
          {currentMessage}
        </motion.p>

        <div className="flex items-center justify-center gap-2">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
            {loadingSeconds}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">seconds</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-48 mx-auto">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min((loadingSeconds / 10) * 100, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </motion.div>

      {/* Floating particles animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-purple-400 dark:bg-purple-600 rounded-full opacity-40"
            initial={{ 
              x: Math.random() * 400 - 200,
              y: 400,
              scale: 0
            }}
            animate={{ 
              y: -100,
              scale: [0, 1, 0],
              opacity: [0, 0.6, 0]
            }}
            transition={{
              duration: 3,
              delay: i * 0.5,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
    </div>
  );
}