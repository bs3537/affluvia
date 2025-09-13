import React from 'react'
import { AlertTriangle, CheckCircle, Droplets, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercentage } from '@/lib/utils'
import type { EstateScenario, EstateProfile } from '@/types/estate'

interface LiquidityAnalysisProps {
  profile: EstateProfile
  scenario: EstateScenario
}

interface AssetLiquidity {
  category: string
  value: number
  liquidityScore: number // 0-100, where 100 is most liquid
  daysToLiquidate: number
}

export function LiquidityAnalysis({ profile, scenario }: LiquidityAnalysisProps) {
  // Mock asset liquidity data - in real app, this would come from profile data
  const assetLiquidity: AssetLiquidity[] = [
    { category: 'Cash & Cash Equivalents', value: 500000, liquidityScore: 100, daysToLiquidate: 1 },
    { category: 'Publicly Traded Securities', value: 2000000, liquidityScore: 95, daysToLiquidate: 3 },
    { category: 'Private Equity', value: 1000000, liquidityScore: 20, daysToLiquidate: 180 },
    { category: 'Real Estate', value: 3000000, liquidityScore: 30, daysToLiquidate: 90 },
    { category: 'Business Interests', value: 5000000, liquidityScore: 15, daysToLiquidate: 365 },
    { category: 'Personal Property', value: 500000, liquidityScore: 40, daysToLiquidate: 60 },
  ]
  
  const totalAssets = assetLiquidity.reduce((sum, asset) => sum + asset.value, 0)
  const liquidAssets = assetLiquidity
    .filter(asset => asset.liquidityScore >= 80)
    .reduce((sum, asset) => sum + asset.value, 0)
  const semiLiquidAssets = assetLiquidity
    .filter(asset => asset.liquidityScore >= 40 && asset.liquidityScore < 80)
    .reduce((sum, asset) => sum + asset.value, 0)
  const illiquidAssets = assetLiquidity
    .filter(asset => asset.liquidityScore < 40)
    .reduce((sum, asset) => sum + asset.value, 0)
  
  const totalTaxDue = Number(scenario.totalTaxes)
  const otherExpenses = totalAssets * 0.02 // Assume 2% for admin, funeral, etc.
  const totalLiquidityNeeded = totalTaxDue + otherExpenses
  const targetLiquidity = totalLiquidityNeeded * ((scenario.assumptions?.liquidityTarget || 100) / 100)
  
  const liquidityGap = targetLiquidity - liquidAssets
  const liquidityRatio = (liquidAssets / totalLiquidityNeeded) * 100
  const isLiquidityAdequate = liquidityRatio >= (scenario.assumptions?.liquidityTarget || 100)
  
  return (
    <div className="space-y-6">
      {/* Liquidity Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Liquid Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(liquidAssets)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Available within 7 days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Liquidity Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalLiquidityNeeded)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tax + expenses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Liquidity Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{formatPercentage(liquidityRatio)}</p>
              {isLiquidityAdequate ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: {scenario.assumptions?.liquidityTarget || 100}%
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Liquidity Alert */}
      {!isLiquidityAdequate && (
        <Alert className="border-yellow-200 bg-yellow-50/50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle>Liquidity Gap Detected</AlertTitle>
          <AlertDescription>
            You need an additional {formatCurrency(liquidityGap)} in liquid assets to meet your 
            {scenario.assumptions?.liquidityTarget || 100}% liquidity target. Consider liquidating less liquid 
            assets or implementing liquidity planning strategies.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Asset Liquidity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Liquidity Analysis</CardTitle>
          <CardDescription>
            Breakdown of assets by liquidity level and time to convert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assetLiquidity.map((asset) => (
            <div key={asset.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className={`h-4 w-4 ${
                    asset.liquidityScore >= 80 ? 'text-blue-600' :
                    asset.liquidityScore >= 40 ? 'text-yellow-600' :
                    'text-red-600'
                  }`} />
                  <span className="text-sm font-medium">{asset.category}</span>
                  <Badge variant="outline" className="text-xs">
                    {asset.daysToLiquidate} days
                  </Badge>
                </div>
                <span className="text-sm font-medium">{formatCurrency(asset.value)}</span>
              </div>
              <Progress 
                value={asset.liquidityScore} 
                className="h-2"
              />
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* Liquidity Planning Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Liquidity Planning Strategies</CardTitle>
          <CardDescription>
            Recommendations to improve estate liquidity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Life Insurance</p>
                <p className="text-xs text-muted-foreground">
                  Consider an ILIT with coverage equal to expected estate taxes
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Asset Reallocation</p>
                <p className="text-xs text-muted-foreground">
                  Shift {formatPercentage(10)} of illiquid assets to marketable securities
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Buy-Sell Agreements</p>
                <p className="text-xs text-muted-foreground">
                  Establish funded agreements for business interests
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Graegin Loan</p>
                <p className="text-xs text-muted-foreground">
                  Structure estate loan to create liquidity and tax deduction
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700 font-medium">Liquid (0-7 days)</p>
          <p className="text-xl font-bold text-blue-900">{formatCurrency(liquidAssets)}</p>
          <p className="text-xs text-blue-600">{formatPercentage(liquidAssets / totalAssets * 100)} of estate</p>
        </div>
        
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-700 font-medium">Semi-Liquid (8-90 days)</p>
          <p className="text-xl font-bold text-yellow-900">{formatCurrency(semiLiquidAssets)}</p>
          <p className="text-xs text-yellow-600">{formatPercentage(semiLiquidAssets / totalAssets * 100)} of estate</p>
        </div>
        
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-red-700 font-medium">Illiquid (90+ days)</p>
          <p className="text-xl font-bold text-red-900">{formatCurrency(illiquidAssets)}</p>
          <p className="text-xs text-red-600">{formatPercentage(illiquidAssets / totalAssets * 100)} of estate</p>
        </div>
        
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-700 font-medium">9-Month Cash Need</p>
          <p className="text-xl font-bold text-purple-900">{formatCurrency(totalLiquidityNeeded)}</p>
          <p className="text-xs text-purple-600">IRC §6161 deadline</p>
        </div>
      </div>
    </div>
  )
}