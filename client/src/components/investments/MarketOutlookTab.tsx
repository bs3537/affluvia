import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Calendar, Activity, ChartBar, AlertCircle } from "lucide-react";

interface MarketEvent {
  event: string;
  date: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  impact?: string;
}

interface MarketDirection {
  trend: string;
  sentiment: string;
  keyDrivers: string[];
}

interface MarketOutlookData {
  marketSummary: string;
  recentData: MarketEvent[];
  upcomingData: MarketEvent[];
  marketDirection?: MarketDirection;
}

interface MarketOutlookTabProps {
  data: {
    marketOutlook?: MarketOutlookData;
  };
}

export function MarketOutlookTab({ data }: MarketOutlookTabProps) {
  if (!data.marketOutlook) return null;

  console.log('[MarketOutlookTab] Received data:', data.marketOutlook);
  console.log('[MarketOutlookTab] Has recentData:', data.marketOutlook?.recentData);
  console.log('[MarketOutlookTab] Has upcomingData:', data.marketOutlook?.upcomingData);
  
  // Handle both old and new data formats
  const marketOutlook = data.marketOutlook as any;
  
  // Check if we have the old format and show a message to refresh
  if (!marketOutlook.marketSummary && marketOutlook.headline) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
          Old data format detected. Please click "Get Fresh Data" to see the new market analysis.
        </p>
      </Card>
    );
  }
  
  const { marketSummary, recentData = [], upcomingData = [], marketDirection } = marketOutlook;

  const getTrendIcon = (trend?: string) => {
    switch (trend?.toLowerCase()) {
      case 'bullish':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'bearish':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getImpactColor = (impact?: string) => {
    switch (impact?.toLowerCase()) {
      case 'positive':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'negative':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'high':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300';
      case 'medium':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Market Summary Card */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950">
        <div className="flex items-center justify-between">
          <div className="flex-grow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              {getTrendIcon(marketDirection?.trend)}
              US Market Outlook
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
              {marketSummary || "Loading market analysis..."}
            </p>
          </div>
          {marketDirection && (
            <Badge className={`ml-4 ${marketDirection.sentiment === 'Risk-on' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {marketDirection.sentiment}
            </Badge>
          )}
        </div>
        {marketDirection?.keyDrivers && marketDirection.keyDrivers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {marketDirection.keyDrivers.map((driver: any, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {driver}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Economic Data */}
      {recentData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Recent US Macroeconomic Data (Past Week)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Event</th>
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Actual</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Forecast</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Previous</th>
                  <th className="text-center py-2 font-medium text-gray-700 dark:text-gray-300">Impact</th>
                </tr>
              </thead>
              <tbody>
                {recentData.map((event: any, index: number) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 text-gray-900 dark:text-white font-medium">{event.event}</td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">{event.date}</td>
                    <td className="py-3 text-right text-gray-900 dark:text-white font-semibold">
                      {event.actual || '-'}
                    </td>
                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                      {event.forecast || '-'}
                    </td>
                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                      {event.previous || '-'}
                    </td>
                    <td className="py-3 text-center">
                      <Badge className={`text-xs ${getImpactColor(event.impact)}`}>
                        {event.impact || 'Neutral'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Upcoming Economic Events */}
      {upcomingData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Upcoming US Macroeconomic Events (Next Week)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Event</th>
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Forecast</th>
                  <th className="text-center py-2 font-medium text-gray-700 dark:text-gray-300">Expected Impact</th>
                </tr>
              </thead>
              <tbody>
                {upcomingData.map((event: any, index: number) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 text-gray-900 dark:text-white font-medium">{event.event}</td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">{event.date}</td>
                    <td className="py-3 text-right text-gray-900 dark:text-white">
                      {event.forecast || '-'}
                    </td>
                    <td className="py-3 text-center">
                      <Badge className={`text-xs ${getImpactColor(event.impact)}`}>
                        {event.impact || 'Medium'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Market Indicators */}
      {marketDirection && (
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ChartBar className="h-5 w-5 text-purple-600" />
            Market Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Market Trend</p>
              <div className="flex items-center justify-center gap-2">
                {getTrendIcon(marketDirection.trend)}
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {marketDirection.trend}
                </p>
              </div>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sentiment</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {marketDirection.sentiment}
              </p>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Key Drivers</p>
              <p className="text-lg font-semibold text-purple-600">
                {marketDirection.keyDrivers.length} Factors
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* No data message */}
      {!marketSummary && !recentData.length && !upcomingData.length && (
        <Card className="p-8 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            No market data available. Please try refreshing.
          </p>
        </Card>
      )}
    </motion.div>
  );
}