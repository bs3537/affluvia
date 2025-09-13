import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Copy, Trash2, Edit2, Check, X, Download, Info, TrendingUp, TrendingDown, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency, formatPercentage } from '@/lib/utils'
import { estatePlanningService } from '@/services/estate-planning.service'
import { ScenarioModal } from './scenario-modal'
import { ScenarioComparisonCard } from './scenario-comparison-card'
import { LiquidityAnalysis } from './liquidity-analysis'
import { ScenarioTiles } from './scenario-tiles'
import { useDebounce } from '@/hooks/use-debounce'
import { useQuery } from '@tanstack/react-query'
import type { EstateProfile, EstateScenario, EstateAssumptions } from '@/types/estate'
import type { ScenarioResult } from '@/types/estate'

interface PlanningScenarioProps {
  profile: EstateProfile
  onUpdate: () => void
}

export function PlanningScenarios({ profile, onUpdate }: PlanningScenarioProps) {
  const [scenarios, setScenarios] = useState<EstateScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScenario, setSelectedScenario] = useState<EstateScenario | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingScenario, setEditingScenario] = useState<EstateScenario | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [baselineId, setBaselineId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'calculated' | 'custom'>('calculated')

  // Fetch calculated scenarios
  const { data: calculatedScenarios, isLoading: calculatedLoading, refetch: refetchCalculated } = useQuery({
    queryKey: ['calculated-estate-scenarios'],
    queryFn: async () => {
      const response = await fetch('/api/estate-scenarios/calculated-scenarios', {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch calculated scenarios')
      const data = await response.json()
      return data.scenarios as ScenarioResult[]
    }
  })

  // Load scenarios on mount
  useEffect(() => {
    loadScenarios()
  }, [profile.id])

  const loadScenarios = async () => {
    try {
      setLoading(true)
      const data = await estatePlanningService.getEstateScenarios()
      // Cast server data to match client types
      const typedData = data.map((scenario: any) => ({
        ...scenario,
        assumptions: (scenario.assumptions || {}) as EstateAssumptions,
        results: scenario.results || {}
      })) as EstateScenario[]
      setScenarios(typedData)
      
      // Set baseline scenario if exists
      const baseline = typedData.find((s) => s.isBaseline)
      if (baseline) {
        setBaselineId(baseline.id.toString())
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateScenario = () => {
    setEditingScenario(null)
    setIsModalOpen(true)
  }

  const handleEditScenario = (scenario: EstateScenario) => {
    setEditingScenario(scenario)
    setIsModalOpen(true)
  }

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!confirm('Are you sure you want to delete this scenario?')) return
    
    try {
      await estatePlanningService.deleteEstateScenario(parseInt(scenarioId))
      await loadScenarios()
      onUpdate()
    } catch (error) {
      console.error('Failed to delete scenario:', error)
    }
  }

  const handleDuplicateScenario = async (scenario: EstateScenario) => {
    try {
      const newScenario = {
        ...scenario,
        id: undefined,
        scenarioName: `${scenario.scenarioName} (Copy)`,
        isBaseline: false,
      }
      await estatePlanningService.createEstateScenario(newScenario)
      await loadScenarios()
      onUpdate()
    } catch (error) {
      console.error('Failed to duplicate scenario:', error)
    }
  }

  const handleSetBaseline = async (scenarioId: string) => {
    try {
      // First, unset current baseline
      const currentBaseline = scenarios.find(s => s.isBaseline)
      if (currentBaseline) {
        await estatePlanningService.updateEstateScenario(currentBaseline.id, { isBaseline: false })
      }
      
      // Set new baseline
      await estatePlanningService.updateEstateScenario(parseInt(String(scenarioId)), { isBaseline: true })
      setBaselineId(scenarioId)
      await loadScenarios()
      onUpdate()
    } catch (error) {
      console.error('Failed to set baseline:', error)
    }
  }

  const handleSaveScenario = async (scenarioData: Partial<EstateScenario>) => {
    try {
      if (editingScenario) {
        await estatePlanningService.updateEstateScenario(editingScenario.id, scenarioData)
      } else {
        await estatePlanningService.createEstateScenario(scenarioData)
      }
      await loadScenarios()
      onUpdate()
      setIsModalOpen(false)
    } catch (error) {
      console.error('Failed to save scenario:', error)
    }
  }

  const getScenarioComparison = (scenario: EstateScenario, baseline: EstateScenario) => {
    const scenarioTaxes = typeof scenario.totalTaxes === 'number' ? scenario.totalTaxes : parseFloat(String(scenario.totalTaxes || 0))
    const baselineTaxes = typeof baseline.totalTaxes === 'number' ? baseline.totalTaxes : parseFloat(String(baseline.totalTaxes || 0))
    const scenarioNet = typeof scenario.netToHeirs === 'number' ? scenario.netToHeirs : parseFloat(String(scenario.netToHeirs || 0))
    const baselineNet = typeof baseline.netToHeirs === 'number' ? baseline.netToHeirs : parseFloat(String(baseline.netToHeirs || 0))
    
    const taxDiff = scenarioTaxes - baselineTaxes
    const netDiff = scenarioNet - baselineNet
    const taxDiffPercent = baselineTaxes > 0 ? (taxDiff / baselineTaxes) * 100 : 0
    const netDiffPercent = baselineNet > 0 ? (netDiff / baselineNet) * 100 : 0

    return {
      taxDiff,
      netDiff,
      taxDiffPercent,
      netDiffPercent,
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Progress className="w-48 mb-4" value={33} />
          <p className="text-sm text-muted-foreground">Loading scenarios...</p>
        </div>
      </div>
    )
  }

  const baselineScenario = scenarios.find(s => s.id === (baselineId ? parseInt(baselineId) : null))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Estate Planning Scenario Modeler</h3>
          <p className="text-sm text-muted-foreground">
            Model different strategies and compare outcomes
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'calculated' | 'custom')}>
        <TabsList className="grid w-full grid-cols-2 bg-gray-800 border-gray-700">
          <TabsTrigger value="calculated" className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">
            <Calculator className="h-4 w-4" />
            Tax Scenarios
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">
            <Plus className="h-4 w-4" />
            Custom Scenarios
          </TabsTrigger>
        </TabsList>

        {/* Calculated Scenarios Tab */}
        <TabsContent value="calculated" className="mt-6">
          {calculatedLoading ? (
            <ScenarioTiles scenarios={[]} loading={true} />
          ) : calculatedScenarios ? (
            <ScenarioTiles 
              scenarios={calculatedScenarios} 
              onRefresh={() => refetchCalculated()}
            />
          ) : (
            <Alert>
              <AlertDescription>
                Unable to load calculated scenarios. Please ensure your financial profile is complete.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Custom Scenarios Tab */}
        <TabsContent value="custom" className="mt-6">
          <div className="space-y-6">
            {/* Custom Scenarios Header */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Create and manage custom estate planning scenarios
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompareMode(!compareMode)}
                  className={compareMode ? 'bg-purple-50 border-purple-300' : ''}
                >
                  {compareMode ? 'Exit Compare' : 'Compare Mode'}
                </Button>
                <Button onClick={handleCreateScenario} size="sm" className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20 hover:shadow-purple-700/30 transition-all">
                  <Plus className="h-4 w-4 mr-2" />
                  New Scenario
                </Button>
              </div>
            </div>

            {/* CFP Compliance Alert */}
            <Alert className="border-blue-800 bg-blue-900/20">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-sm text-gray-300">
                <strong>CFP Board Alignment:</strong> These scenarios follow CFP Step 3 (Analyze & Evaluate) 
                by comparing multiple strategies. The recommended scenario aligns with Step 4 (Develop Recommendations).
              </AlertDescription>
            </Alert>

            {/* Scenarios Grid */}
            {scenarios.length === 0 ? (
              <Card className="border-dashed bg-gray-800 border-gray-700">
                <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-12 h-12 bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                    <Plus className="h-6 w-6 text-purple-400" />
                  </div>
                  <h4 className="font-medium mb-2 text-gray-100">No scenarios yet</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    Create your first scenario to start comparing estate planning strategies
                  </p>
                  <Button onClick={handleCreateScenario} className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20 hover:shadow-purple-700/30 transition-all">
                    Create First Scenario
                  </Button>
                </CardContent>
              </Card>
      ) : (
        <div className={`grid gap-4 ${compareMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
          {scenarios.map((scenario) => {
            const comparison = baselineScenario && scenario.id !== (baselineId ? parseInt(baselineId) : null)
              ? getScenarioComparison(scenario, baselineScenario)
              : null

            return (
              <Card 
                key={scenario.id} 
                className={`relative transition-all bg-gray-800 border-gray-700 hover:bg-gray-750 ${
                  scenario.isBaseline ? 'ring-2 ring-purple-500' : ''
                } ${
                  selectedScenario?.id === scenario.id ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2 text-gray-100">
                        {scenario.scenarioName}
                        {scenario.isBaseline && (
                          <Badge variant="secondary" className="text-xs bg-purple-900/50 text-purple-300 border-purple-700">
                            Baseline
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1 text-gray-400">
                        {scenario.scenarioType}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditScenario(scenario)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit scenario</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDuplicateScenario(scenario)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate scenario</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {!scenario.isBaseline && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteScenario(scenario.id.toString())}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete scenario</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Total Estate Tax</p>
                      <p className="text-lg font-semibold text-gray-100">
                        {formatCurrency(scenario.totalTaxes || 0)}
                      </p>
                      {comparison && compareMode && (
                        <p className={`text-xs flex items-center gap-1 ${
                          comparison.taxDiff < 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {comparison.taxDiff < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {formatCurrency(Math.abs(comparison.taxDiff))} 
                          ({formatPercentage(Math.abs(comparison.taxDiffPercent))})
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500">Net to Heirs</p>
                      <p className="text-lg font-semibold text-gray-100">
                        {formatCurrency(scenario.netToHeirs || 0)}
                      </p>
                      {comparison && compareMode && (
                        <p className={`text-xs flex items-center gap-1 ${
                          comparison.netDiff > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {comparison.netDiff > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatCurrency(Math.abs(comparison.netDiff))} 
                          ({formatPercentage(Math.abs(comparison.netDiffPercent))})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Assumptions Summary */}
                  {scenario.assumptions && (
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">Key Assumptions</p>
                      <div className="space-y-1">
                        {scenario.assumptions.yearOfDeath && (
                          <p className="text-xs text-gray-400">
                            Year of death: {scenario.assumptions.yearOfDeath}
                          </p>
                        )}
                        {scenario.assumptions.portability && (
                          <p className="text-xs text-gray-400">
                            ✓ Portability election
                          </p>
                        )}
                        {scenario.assumptions.strategies && scenario.assumptions.strategies.length > 0 && (
                          <p className="text-xs text-gray-400">
                            Strategies: {scenario.assumptions.strategies.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {!scenario.isBaseline && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-gray-600 hover:bg-gray-700 hover:border-gray-500"
                        onClick={() => handleSetBaseline(scenario.id.toString())}
                      >
                        Set as Baseline
                      </Button>
                    )}
                    <Button
                      variant={selectedScenario?.id === scenario.id ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 ${selectedScenario?.id === scenario.id ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-600 hover:bg-gray-700 hover:border-gray-500'}`}
                      onClick={() => setSelectedScenario(
                        selectedScenario?.id === scenario.id ? null : scenario
                      )}
                    >
                      {selectedScenario?.id === scenario.id ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

            {/* Detailed Analysis for Selected Scenario */}
            {selectedScenario && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-100">Detailed Analysis: {selectedScenario.scenarioName}</CardTitle>
                  <CardDescription className="text-gray-400">
                    Comprehensive breakdown of tax implications and liquidity requirements
                  </CardDescription>
                </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid grid-cols-4 w-full bg-gray-800 border-gray-700">
                <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">Overview</TabsTrigger>
                <TabsTrigger value="federal" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">Federal Tax</TabsTrigger>
                <TabsTrigger value="state" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">State Tax</TabsTrigger>
                <TabsTrigger value="liquidity" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">Liquidity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <ScenarioComparisonCard
                  scenario={selectedScenario}
                  baseline={baselineScenario}
                  profile={profile}
                />
              </TabsContent>

              <TabsContent value="federal">
                {/* Federal tax detailed breakdown */}
                <div className="space-y-4">
                  <h4 className="font-medium">Federal Estate Tax Calculation</h4>
                  {/* Add detailed federal tax breakdown */}
                </div>
              </TabsContent>

              <TabsContent value="state">
                {/* State tax detailed breakdown */}
                <div className="space-y-4">
                  <h4 className="font-medium">State Estate Tax Calculation</h4>
                  {/* Add detailed state tax breakdown */}
                </div>
              </TabsContent>

              <TabsContent value="liquidity">
                <LiquidityAnalysis
                  profile={profile}
                  scenario={selectedScenario}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

            {/* Scenario Modal */}
            {isModalOpen && (
              <ScenarioModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveScenario}
                scenario={editingScenario}
                profile={profile}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}