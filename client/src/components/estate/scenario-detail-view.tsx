import React from 'react'
import { Info, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'
import { ScenarioResult } from '@/types/estate'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface ScenarioDetailViewProps {
  scenario: ScenarioResult
}

export function ScenarioDetailView({ scenario }: ScenarioDetailViewProps) {
  const renderChart = () => {
    if (!scenario.visualData) return null

    const chartOptions: ChartOptions<any> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: false,
        },
      },
    }

    switch (scenario.visualData.chartType) {
      case 'bar':
        return (
          <div className="h-64">
            <Bar data={scenario.visualData.data} options={chartOptions} />
          </div>
        )
      
      case 'comparison':
        const compData = scenario.visualData.data
        return (
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-100">Portability Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Estate Tax</span>
                    <span className="font-medium text-red-400">
                      ${compData.portability.tax.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Net to Heirs</span>
                    <span className="font-medium text-green-400">
                      ${compData.portability.netToHeirs.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-100">Bypass Trust Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Estate Tax</span>
                    <span className="font-medium text-red-400">
                      ${compData.bypass.tax.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Net to Heirs</span>
                    <span className="font-medium text-green-400">
                      ${compData.bypass.netToHeirs.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      
      case 'timeline':
        // Timeline visualization for gifting scenario
        return (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-600"></div>
              <div className="space-y-6 relative">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-100">Today</p>
                    <p className="text-sm text-gray-400">
                      Estate Value: ${scenario.visualData.data.withGift.initial.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-100">2025 Gift</p>
                    <p className="text-sm text-gray-400">
                      Gift Amount: ${scenario.visualData.data.withGift.gifted.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-100">At Death</p>
                    <p className="text-sm text-gray-400">
                      Gift Value: ${scenario.visualData.data.withGift.giftGrowth.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-400">
                      Estate Value: ${scenario.visualData.data.withGift.final.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'liquidity':
        const liqData = scenario.visualData.data
        return (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Liquidity Coverage</span>
                <span className="text-sm font-medium text-gray-200">
                  {((liqData.liquidAvailable / liqData.taxDue) * 100).toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={(liqData.liquidAvailable / liqData.taxDue) * 100} 
                className="h-3 bg-gray-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-red-900/20 border border-red-800 rounded-lg">
                <p className="text-sm text-red-400">Tax Due</p>
                <p className="text-xl font-bold text-red-300">
                  ${liqData.taxDue.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                <p className="text-sm text-blue-400">Liquid Assets</p>
                <p className="text-xl font-bold text-blue-300">
                  ${liqData.liquidAvailable.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Scenario Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">{scenario.summary}</p>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Key Metrics</CardTitle>
          <CardDescription className="text-gray-400">Detailed financial impact analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(scenario.metrics).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
                <span className="text-sm font-medium text-gray-300">{key}</span>
                <span className={`font-semibold ${
                  typeof value === 'string' && value.includes('$') && value.includes('-')
                    ? 'text-red-400'
                    : typeof value === 'string' && value.includes('$')
                    ? 'text-green-400'
                    : 'text-gray-200'
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Visual Analysis */}
      {scenario.visualData && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">Visual Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {renderChart()}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {scenario.actionItem && (
        <Alert className="border-purple-800 bg-purple-900/20">
          <AlertCircle className="h-4 w-4 text-purple-400" />
          <AlertTitle className="text-gray-100">Recommended Action</AlertTitle>
          <AlertDescription className="mt-2 text-gray-300">
            {scenario.actionItem}
          </AlertDescription>
        </Alert>
      )}

      {/* Assumptions */}
      {scenario.assumptions && scenario.assumptions.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-base text-gray-100">Calculation Assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {scenario.assumptions.map((assumption, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-400">{assumption}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Additional Information Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-900 border-gray-700">
          <TabsTrigger value="details" className="data-[state=active]:bg-gray-700">Details</TabsTrigger>
          <TabsTrigger value="strategies" className="data-[state=active]:bg-gray-700">Strategies</TabsTrigger>
          <TabsTrigger value="resources" className="data-[state=active]:bg-gray-700">Resources</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="space-y-4">
          {getScenarioDetails(scenario.scenarioId)}
        </TabsContent>
        
        <TabsContent value="strategies" className="space-y-4">
          {getImplementationStrategies(scenario.scenarioId)}
        </TabsContent>
        
        <TabsContent value="resources" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base text-gray-100">Additional Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  <a href="#" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                    IRS guidance on 2026 exemption sunset
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  <a href="#" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                    Estate planning strategies guide
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  <a href="#" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                    State estate tax information
                  </a>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper functions for scenario-specific content
function getScenarioDetails(scenarioId: string): React.ReactNode {
  switch (scenarioId) {
    case 'sunset_vs_current':
      return (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-base text-gray-100">Understanding the 2026 Sunset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-400">
              The Tax Cuts and Jobs Act (TCJA) temporarily doubled the estate tax exemption through 2025. 
              Unless Congress acts, the exemption will revert to pre-2018 levels (adjusted for inflation) on January 1, 2026.
            </p>
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-200">Key Points:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
                <li>Current exemption (2025): $13.99 million per person</li>
                <li>Post-sunset exemption (2026): ~$7 million per person</li>
                <li>This represents a ~50% reduction in the exemption</li>
                <li>The 40% tax rate remains unchanged</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )
    
    case 'portability_vs_bypass':
      return (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-base text-gray-100">Portability vs. Bypass Trust Explained</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2 text-gray-200">Portability Election</h4>
              <p className="text-sm text-gray-400">
                Allows the surviving spouse to use the deceased spouse's unused exemption (DSUE). 
                Simple but doesn't protect against future estate growth.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2 text-gray-200">Bypass Trust</h4>
              <p className="text-sm text-gray-400">
                Funds a trust at first death up to the exemption amount. 
                More complex but shelters all future appreciation from estate tax.
              </p>
            </div>
          </CardContent>
        </Card>
      )
    
    default:
      return null
  }
}

function getImplementationStrategies(scenarioId: string): React.ReactNode {
  const strategies: Record<string, string[]> = {
    sunset_vs_current: [
      'Schedule a meeting with your estate planning attorney before 2025',
      'Review and update your will and trust documents',
      'Consider accelerating lifetime gifts to use the higher exemption',
      'Evaluate advanced planning techniques (GRATs, SLATs, etc.)',
      'Monitor legislative developments that could affect the sunset'
    ],
    portability_vs_bypass: [
      'Discuss with your spouse about trust preferences',
      'Review beneficiary designations on all accounts',
      'Consider state estate tax implications',
      'Evaluate need for asset protection benefits',
      'Plan for potential remarriage scenarios'
    ],
    lifetime_gifts: [
      'Identify assets best suited for gifting (high-growth potential)',
      'Consider creating irrevocable trusts for gift recipients',
      'Document all gifts properly for tax reporting',
      'Retain sufficient assets for your lifestyle needs',
      'Coordinate with your CPA on gift tax returns'
    ],
    trust_freeze: [
      'Select appropriate trust structure (GRAT, SLAT, etc.)',
      'Identify high-growth assets for funding',
      'Work with valuation experts for discounts',
      'Ensure proper trust administration',
      'Monitor trust performance against projections'
    ],
    life_insurance: [
      'Obtain insurance quotes from multiple carriers',
      'Create an ILIT before purchasing the policy',
      'Use annual exclusion gifts to fund premiums',
      'Consider second-to-die policies for married couples',
      'Review coverage amounts annually'
    ]
  }

  const items = strategies[scenarioId] || []
  
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-base text-gray-100">Implementation Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-sm font-medium text-purple-400">{index + 1}.</span>
              <span className="text-sm text-gray-400">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}