import React from 'react'
import { ArrowRight, TrendingUp, TrendingDown, DollarSign, Users, Shield, Droplets } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatPercentage } from '@/lib/utils'
import type { EstateScenario, EstateProfile } from '@/types/estate'

interface ScenarioComparisonCardProps {
  scenario: EstateScenario
  baseline?: EstateScenario | null
  profile: EstateProfile
}

export function ScenarioComparisonCard({ scenario, baseline, profile }: ScenarioComparisonCardProps) {
  const totalEstate = profile.totalAssets - profile.totalLiabilities
  const scenarioTaxes = typeof scenario.totalTaxes === 'number' ? scenario.totalTaxes : parseFloat(String(scenario.totalTaxes || 0))
  const effectiveRate = totalEstate > 0 ? (scenarioTaxes / totalEstate) * 100 : 0
  
  const getComparison = () => {
    if (!baseline || scenario.id === baseline.id) return null
    
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
      isBetter: taxDiff < 0 || netDiff > 0,
    }
  }
  
  const comparison = getComparison()

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Key Metrics Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tax Impact Summary</span>
            {comparison?.isBetter && (
              <Badge className="bg-green-100 text-green-800">
                Recommended
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Total estate value: {formatCurrency(totalEstate)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Total Estate Tax</span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatCurrency(scenario.totalTaxes)}</p>
                {comparison && (
                  <p className={`text-sm flex items-center gap-1 ${
                    comparison.taxDiff < 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {comparison.taxDiff < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    {formatCurrency(Math.abs(comparison.taxDiff))} vs baseline
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Net to Heirs</span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatCurrency(scenario.netToHeirs)}</p>
                {comparison && (
                  <p className={`text-sm flex items-center gap-1 ${
                    comparison.netDiff > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {comparison.netDiff > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatCurrency(Math.abs(comparison.netDiff))} vs baseline
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Effective Tax Rate</span>
              <span className="font-medium">{formatPercentage(effectiveRate)}</span>
            </div>
            <Progress value={effectiveRate} className="h-2" />
          </div>
          
          {scenario.results?.liquidityGap && scenario.results.liquidityGap > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">Liquidity Gap</span>
                </div>
                <span className="text-sm font-bold text-yellow-700">
                  {formatCurrency(scenario.results.liquidityGap)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Strategy Details */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Implementation</CardTitle>
          <CardDescription>
            Key assumptions and techniques used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {scenario.assumptions?.portability && (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600" />
                <span className="text-sm">
                  Portability election with {formatCurrency(scenario.assumptions?.dsueAmount || 0)} DSUE
                </span>
              </div>
            )}
            
            {scenario.assumptions?.lifetimeGiftAmount && scenario.assumptions.lifetimeGiftAmount > 0 && (
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  Lifetime gifting: {formatCurrency(scenario.assumptions?.lifetimeGiftAmount || 0)}
                </span>
              </div>
            )}
            
            {scenario.assumptions?.annualGiftAmount && scenario.assumptions.annualGiftAmount > 0 && (
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  Annual gifting: {formatCurrency(scenario.assumptions?.annualGiftAmount || 0)}/year
                </span>
              </div>
            )}
            
            {scenario.assumptions?.strategies && scenario.assumptions.strategies.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Trust Strategies:</p>
                <div className="pl-6 space-y-1">
                  {scenario.assumptions?.strategies?.map((strategy: any) => (
                    <div key={strategy} className="text-sm text-muted-foreground">
                      • {strategy}
                      {scenario.assumptions?.trustFunding?.[strategy] && (
                        <span className="ml-2">
                          ({formatCurrency(scenario.assumptions.trustFunding[strategy])})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Year of Death</p>
              <p className="font-medium">{scenario.assumptions?.yearOfDeath || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Growth Rate</p>
              <p className="font-medium">{scenario.assumptions?.appreciationRate || 0}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Federal Exemption</p>
              <p className="font-medium">{formatCurrency(scenario.assumptions?.federalExemption || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Discount Rate</p>
              <p className="font-medium">{scenario.assumptions?.discountRate || 0}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}