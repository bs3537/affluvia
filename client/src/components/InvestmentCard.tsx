import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Building2, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

interface InvestmentCardProps {
  rank: number;
  ticker: string;
  name: string;
  oneLinePitch: string;
  metricLabel: string;
  metricValue: string;
  marketCap?: string;
  sector?: string;
  isBackfill?: boolean;
}

export function InvestmentCard({
  rank,
  ticker,
  name,
  oneLinePitch,
  metricLabel,
  metricValue,
  marketCap,
  sector,
  isBackfill = false,
}: InvestmentCardProps) {
  const fcfGrowth = parseFloat(metricValue.replace('%', ''));
  const isHighGrowth = fcfGrowth > 100;
  const isModerateGrowth = fcfGrowth > 50;

  const growthColor = isHighGrowth 
    ? "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300" 
    : isModerateGrowth 
    ? "text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200"
    : "text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.05 }}
    >
      <Card className="p-6 hover:shadow-xl transition-all duration-200 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shadow-lg ${
              rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white' :
              rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-white' :
              rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white' :
              'bg-purple-600 text-white'
            }`}>
              {rank}
            </div>
          </div>
          
          <div className="flex-grow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {ticker}
                  </h3>
                  {sector && (
                    <Badge variant="outline" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1" />
                      {sector}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{name}</p>
              </div>
              
              <div className="text-right">
                <Badge 
                  className={`${growthColor} font-bold text-sm px-3 py-1`}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {metricLabel}: {metricValue}
                </Badge>
                {marketCap && (
                  <div className="mt-2 flex items-center justify-end text-sm text-gray-600 dark:text-gray-400">
                    <DollarSign className="h-4 w-4" />
                    <span>{marketCap}</span>
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 italic leading-relaxed">
              "{oneLinePitch}"
            </p>

            {isHighGrowth && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                  🚀 High Growth
                </Badge>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}