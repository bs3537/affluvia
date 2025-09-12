import React, { useState } from 'react'
import { 
  Calendar, Shield, Gift, TrendingUp, Heart, 
  ChevronRight, Info, Download, Lightbulb 
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils'
import { ScenarioResult } from '@/types/estate'
import { ScenarioDetailView } from './scenario-detail-view'

interface ScenarioTilesProps {
  scenarios: ScenarioResult[]
  loading?: boolean
  onRefresh?: () => void
}

const scenarioIcons: Record<string, React.ReactNode> = {
  'sunset_vs_current': <Calendar className="h-5 w-5" />,
  'portability_vs_bypass': <Shield className="h-5 w-5" />,
  'lifetime_gifts': <Gift className="h-5 w-5" />,
  'trust_freeze': <TrendingUp className="h-5 w-5" />,
  'life_insurance': <Heart className="h-5 w-5" />
}

const scenarioColors: Record<string, string> = {
  'sunset_vs_current': 'bg-orange-900/20 text-orange-400 border-orange-800',
  'portability_vs_bypass': 'bg-blue-900/20 text-blue-400 border-blue-800',
  'lifetime_gifts': 'bg-green-900/20 text-green-400 border-green-800',
  'trust_freeze': 'bg-purple-900/20 text-purple-400 border-purple-800',
  'life_insurance': 'bg-pink-900/20 text-pink-400 border-pink-800'
}

export function ScenarioTiles({ scenarios, loading = false, onRefresh }: ScenarioTilesProps) {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioResult | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleViewDetails = (scenario: ScenarioResult) => {
    setSelectedScenario(scenario)
    setDetailOpen(true)
  }

  const getHighlightMetric = (scenario: ScenarioResult): { label: string; value: string; isPositive: boolean } => {
    switch (scenario.scenarioId) {
      case 'sunset_vs_current':
        return {
          label: 'Additional Tax in 2026',
          value: scenario.metrics['Additional Tax Due'] as string || '$0',
          isPositive: false
        }
      case 'portability_vs_bypass':
        return {
          label: 'Tax Savings with Bypass',
          value: scenario.metrics['Tax Savings (Bypass)'] as string || '$0',
          isPositive: true
        }
      case 'lifetime_gifts':
        return {
          label: 'Tax Savings from Gifting',
          value: scenario.metrics['Tax Savings'] as string || '$0',
          isPositive: true
        }
      case 'trust_freeze':
        return {
          label: 'Wealth Transferred Tax-Free',
          value: scenario.metrics['Wealth Transferred Tax-Free'] as string || '$0',
          isPositive: true
        }
      case 'life_insurance':
        return {
          label: 'Liquidity Gap',
          value: scenario.metrics['Liquidity Gap'] as string || '$0',
          isPositive: false
        }
      default:
        return { label: 'Impact', value: '$0', isPositive: true }
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="h-6 bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-700 rounded w-full mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-8 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Introduction */}
      <div className="mb-6">
        <Alert className="border-blue-800 bg-blue-900/20">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-gray-300">
            <strong>Estate Tax Scenario Analysis:</strong> We've modeled five critical estate planning scenarios 
            based on your financial profile. Each tile shows the potential tax impact and recommended strategies. 
            Click any scenario to explore detailed calculations and action items.
          </AlertDescription>
        </Alert>
      </div>

      {/* Scenario Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario) => {
          const highlight = getHighlightMetric(scenario)
          const colorClass = scenarioColors[scenario.scenarioId] || 'bg-gray-100 text-gray-800'
          
          return (
            <Card 
              key={scenario.scenarioId}
              className="relative hover:shadow-lg transition-shadow cursor-pointer bg-gray-800 border-gray-700 hover:bg-gray-750"
              onClick={() => handleViewDetails(scenario)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      {scenarioIcons[scenario.scenarioId]}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base text-gray-100">{scenario.title}</CardTitle>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-xs mt-2 text-gray-400">
                  {scenario.summary}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Highlight Metric */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">{highlight.label}</p>
                  <p className={`text-2xl font-bold ${
                    highlight.isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {highlight.value}
                  </p>
                </div>

                {/* Key Metrics */}
                <div className="space-y-2">
                  {Object.entries(scenario.metrics).slice(0, 2).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500">{key}:</span>
                      <span className="font-medium text-gray-200">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Action Item Preview */}
                {scenario.actionItem && (
                  <div className="pt-3 border-t border-gray-700">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {scenario.actionItem}
                      </p>
                    </div>
                  </div>
                )}

                {/* View Details Button */}
                <Button 
                  size="sm" 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg shadow-purple-600/20 hover:shadow-purple-700/30 transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewDetails(scenario)
                  }}
                >
                  View Details
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Scenario Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-100">
              <div className={`p-2 rounded-lg ${
                selectedScenario ? scenarioColors[selectedScenario.scenarioId] : ''
              }`}>
                {selectedScenario && scenarioIcons[selectedScenario.scenarioId]}
              </div>
              {selectedScenario?.title}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Detailed analysis and recommendations
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {selectedScenario && (
              <ScenarioDetailView scenario={selectedScenario} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}