import React, { useState, useEffect } from 'react'
import { X, Info, Calculator, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatPercentage } from '@/lib/utils'
import { calculateEstateTax } from '@/lib/estate-calculations'
import type { EstateScenario, EstateProfile } from '@/types/estate'

interface ScenarioModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (scenario: Partial<EstateScenario>) => Promise<void> | void
  scenario?: EstateScenario | null
  profile: EstateProfile
}

const TCJA_SUNSET_YEAR = 2026
const CURRENT_YEAR = new Date().getFullYear()

const FEDERAL_EXEMPTIONS: Record<number, number> = {
  2024: 13610000,
  2025: 13990000,
  2026: 7000000, // Post-sunset estimate
}

const TRUST_STRATEGIES = [
  { value: 'GRAT', label: 'Grantor Retained Annuity Trust (GRAT)' },
  { value: 'SLAT', label: 'Spousal Lifetime Access Trust (SLAT)' },
  { value: 'ILIT', label: 'Irrevocable Life Insurance Trust (ILIT)' },
  { value: 'CLT', label: 'Charitable Lead Trust (CLT)' },
  { value: 'CRT', label: 'Charitable Remainder Trust (CRT)' },
  { value: 'QPRT', label: 'Qualified Personal Residence Trust (QPRT)' },
  { value: 'DAF', label: 'Donor Advised Fund (DAF)' },
  { value: 'FLP', label: 'Family Limited Partnership (FLP)' },
]

export function ScenarioModal({ isOpen, onClose, onSave, scenario, profile }: ScenarioModalProps) {
  const [formData, setFormData] = useState({
    scenarioName: scenario?.scenarioName || '',
    scenarioType: scenario?.scenarioType || 'custom',
    description: scenario?.description || '',
    assumptions: {
      yearOfDeath: scenario?.assumptions?.yearOfDeath || CURRENT_YEAR + 10,
      federalExemption: scenario?.assumptions?.federalExemption || FEDERAL_EXEMPTIONS[2024],
      stateExemption: scenario?.assumptions?.stateExemption || 0,
      portability: scenario?.assumptions?.portability || false,
      dsueAmount: scenario?.assumptions?.dsueAmount || 0,
      annualGiftAmount: scenario?.assumptions?.annualGiftAmount || 0,
      lifetimeGiftAmount: scenario?.assumptions?.lifetimeGiftAmount || 0,
      appreciationRate: scenario?.assumptions?.appreciationRate || 5,
      discountRate: scenario?.assumptions?.discountRate || 0,
      strategies: scenario?.assumptions?.strategies || [],
      trustFunding: scenario?.assumptions?.trustFunding || {},
      liquidityTarget: scenario?.assumptions?.liquidityTarget || 110,
    },
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('basic')
  
  // Calculate tax in real-time as user makes changes
  const calculationResult = React.useMemo(() => {
    return calculateEstateTax(profile, { assumptions: formData.assumptions })
  }, [profile, formData.assumptions])

  // Update federal exemption based on year of death
  useEffect(() => {
    const year = formData.assumptions.yearOfDeath
    let exemption = FEDERAL_EXEMPTIONS[2024]
    
    if (year >= TCJA_SUNSET_YEAR) {
      exemption = FEDERAL_EXEMPTIONS[2026]
    } else if (FEDERAL_EXEMPTIONS[year]) {
      exemption = FEDERAL_EXEMPTIONS[year]
    }
    
    setFormData(prev => ({
      ...prev,
      assumptions: {
        ...prev.assumptions,
        federalExemption: exemption,
      },
    }))
  }, [formData.assumptions.yearOfDeath])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.scenarioName.trim()) {
      newErrors.scenarioName = 'Scenario name is required'
    }
    
    if (formData.assumptions.dsueAmount > 0 && !formData.assumptions.portability) {
      newErrors.portability = 'Portability must be elected to use DSUE amount'
    }
    
    if (formData.assumptions.lifetimeGiftAmount > formData.assumptions.federalExemption) {
      newErrors.lifetimeGift = 'Lifetime gifts exceed available exemption'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    
    onSave({
      ...formData,
      totalTaxes: calculationResult.totalTax.toString(),
      netToHeirs: calculationResult.netToHeirs.toString(),
      results: {
        federalTax: calculationResult.federalTax,
        stateTax: calculationResult.stateTax,
        totalTax: calculationResult.totalTax,
        netToHeirs: calculationResult.netToHeirs,
        effectiveRate: calculationResult.effectiveRate,
        liquidityGap: calculationResult.liquidityGap,
      },
    })
  }

  const handleStrategyToggle = (strategy: string) => {
    setFormData(prev => ({
      ...prev,
      assumptions: {
        ...prev.assumptions,
        strategies: prev.assumptions.strategies.includes(strategy)
          ? prev.assumptions.strategies.filter(s => s !== strategy)
          : [...prev.assumptions.strategies, strategy],
      },
    }))
  }

  const handleTrustFundingChange = (trustType: string, amount: number) => {
    setFormData(prev => ({
      ...prev,
      assumptions: {
        ...prev.assumptions,
        trustFunding: {
          ...prev.assumptions.trustFunding,
          [trustType]: amount,
        },
      },
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            {scenario ? 'Edit Scenario' : 'Create New Scenario'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Model different estate planning strategies and their tax implications
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
            <TabsTrigger value="basic" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">Basic Info</TabsTrigger>
            <TabsTrigger value="exemptions" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">Exemptions</TabsTrigger>
            <TabsTrigger value="gifting" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">Gifting</TabsTrigger>
            <TabsTrigger value="strategies" className="data-[state=active]:bg-gray-700 data-[state=inactive]:text-gray-400">Strategies</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenarioName">Scenario Name *</Label>
              <Input
                id="scenarioName"
                value={formData.scenarioName}
                onChange={(e) => setFormData(prev => ({ ...prev, scenarioName: e.target.value }))}
                placeholder="e.g., SLAT + GRAT Strategy"
                className={errors.scenarioName ? 'border-red-500' : ''}
              />
              {errors.scenarioName && (
                <p className="text-xs text-red-500">{errors.scenarioName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scenarioType">Scenario Type</Label>
              <Select
                value={formData.scenarioType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, scenarioType: value }))}
              >
                <SelectTrigger id="scenarioType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline">Baseline (Current Plan)</SelectItem>
                  <SelectItem value="portability">Portability Election</SelectItem>
                  <SelectItem value="gifting">Gifting Strategy</SelectItem>
                  <SelectItem value="trust">Trust Strategy</SelectItem>
                  <SelectItem value="hybrid">Hybrid Strategy</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this scenario"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yearOfDeath">Year of Death</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="yearOfDeath"
                  min={CURRENT_YEAR}
                  max={CURRENT_YEAR + 40}
                  step={1}
                  value={[formData.assumptions.yearOfDeath]}
                  onValueChange={([value]) => setFormData(prev => ({
                    ...prev,
                    assumptions: { ...prev.assumptions, yearOfDeath: value },
                  }))}
                  className="flex-1"
                />
                <span className="w-16 text-sm font-medium">
                  {formData.assumptions.yearOfDeath}
                </span>
              </div>
              {formData.assumptions.yearOfDeath >= TCJA_SUNSET_YEAR && (
                <Alert className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    TCJA exemption sunsets in 2026. Federal exemption will revert to ~$7M per person.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="exemptions" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="federalExemption">Federal Estate Tax Exemption</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="federalExemption"
                  type="number"
                  value={formData.assumptions.federalExemption}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    assumptions: { ...prev.assumptions, federalExemption: Number(e.target.value) },
                  }))}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const year = formData.assumptions.yearOfDeath
                    const defaultExemption = year >= TCJA_SUNSET_YEAR 
                      ? FEDERAL_EXEMPTIONS[2026] 
                      : FEDERAL_EXEMPTIONS[2024]
                    setFormData(prev => ({
                      ...prev,
                      assumptions: { ...prev.assumptions, federalExemption: defaultExemption },
                    }))
                  }}
                >
                  Reset to IRS Default
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Current IRS exemption: {formatCurrency(FEDERAL_EXEMPTIONS[2024])}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stateExemption">State Estate Tax Exemption</Label>
              <Input
                id="stateExemption"
                type="number"
                value={formData.assumptions.stateExemption}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  assumptions: { ...prev.assumptions, stateExemption: Number(e.target.value) },
                }))}
                placeholder="Enter state exemption if applicable"
              />
              <p className="text-xs text-muted-foreground">
                Only 12 states + DC have estate taxes as of 2024
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="portability">Portability Election</Label>
                  <p className="text-xs text-muted-foreground">
                    Use deceased spouse's unused exemption (DSUE)
                  </p>
                </div>
                <Switch
                  id="portability"
                  checked={formData.assumptions.portability}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    assumptions: { ...prev.assumptions, portability: checked },
                  }))}
                />
              </div>

              {formData.assumptions.portability && (
                <div className="space-y-2">
                  <Label htmlFor="dsueAmount">DSUE Amount</Label>
                  <Input
                    id="dsueAmount"
                    type="number"
                    value={formData.assumptions.dsueAmount}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      assumptions: { ...prev.assumptions, dsueAmount: Number(e.target.value) },
                    }))}
                    placeholder="Deceased spouse's unused exemption"
                  />
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Only HI & MD allow state-level portability. Federal portability requires Form 706.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="gifting" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="annualGiftAmount">Annual Gift Amount (per year)</Label>
              <Input
                id="annualGiftAmount"
                type="number"
                value={formData.assumptions.annualGiftAmount}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  assumptions: { ...prev.assumptions, annualGiftAmount: Number(e.target.value) },
                }))}
                placeholder="Amount gifted annually"
              />
              <p className="text-xs text-muted-foreground">
                2024 annual exclusion: $18,000 per person per recipient
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lifetimeGiftAmount">Lifetime Gift Amount (total)</Label>
              <Input
                id="lifetimeGiftAmount"
                type="number"
                value={formData.assumptions.lifetimeGiftAmount}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  assumptions: { ...prev.assumptions, lifetimeGiftAmount: Number(e.target.value) },
                }))}
                placeholder="Total lifetime gifts using exemption"
                className={errors.lifetimeGift ? 'border-red-500' : ''}
              />
              {errors.lifetimeGift && (
                <p className="text-xs text-red-500">{errors.lifetimeGift}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Available exemption: {formatCurrency(
                  formData.assumptions.federalExemption - formData.assumptions.lifetimeGiftAmount
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appreciationRate">Asset Appreciation Rate</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="appreciationRate"
                  min={0}
                  max={15}
                  step={0.5}
                  value={[formData.assumptions.appreciationRate]}
                  onValueChange={([value]) => setFormData(prev => ({
                    ...prev,
                    assumptions: { ...prev.assumptions, appreciationRate: value },
                  }))}
                  className="flex-1"
                />
                <span className="w-12 text-sm font-medium">
                  {formData.assumptions.appreciationRate}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountRate">Valuation Discount Rate</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="discountRate"
                  min={0}
                  max={40}
                  step={5}
                  value={[formData.assumptions.discountRate]}
                  onValueChange={([value]) => setFormData(prev => ({
                    ...prev,
                    assumptions: { ...prev.assumptions, discountRate: value },
                  }))}
                  className="flex-1"
                />
                <span className="w-12 text-sm font-medium">
                  {formData.assumptions.discountRate}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                For FLPs, minority interests, lack of marketability
              </p>
            </div>
          </TabsContent>

          <TabsContent value="strategies" className="space-y-4">
            <div className="space-y-4">
              <h4 className="font-medium">Trust Strategies</h4>
              <div className="space-y-2">
                {TRUST_STRATEGIES.map((trust) => (
                  <div key={trust.value} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={trust.value}
                        checked={formData.assumptions.strategies.includes(trust.value)}
                        onCheckedChange={() => handleStrategyToggle(trust.value)}
                      />
                      <Label
                        htmlFor={trust.value}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {trust.label}
                      </Label>
                    </div>
                    
                    {formData.assumptions.strategies.includes(trust.value) && (
                      <div className="ml-6">
                        <Input
                          type="number"
                          placeholder="Funding amount"
                          value={formData.assumptions.trustFunding[trust.value] || ''}
                          onChange={(e) => handleTrustFundingChange(trust.value, Number(e.target.value))}
                          className="w-48"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="liquidityTarget">Liquidity Buffer Target</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="liquidityTarget"
                  min={100}
                  max={150}
                  step={5}
                  value={[formData.assumptions.liquidityTarget]}
                  onValueChange={([value]) => setFormData(prev => ({
                    ...prev,
                    assumptions: { ...prev.assumptions, liquidityTarget: value },
                  }))}
                  className="flex-1"
                />
                <span className="w-12 text-sm font-medium">
                  {formData.assumptions.liquidityTarget}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of tax + expenses to maintain as liquid assets
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Real-time Calculation Preview */}
        <Card className="mt-6 bg-purple-50/50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Real-time Tax Calculation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Gross Estate</p>
                <p className="font-semibold">{formatCurrency(calculationResult.grossEstate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Tax</p>
                <p className="font-semibold text-red-600">{formatCurrency(calculationResult.totalTax)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net to Heirs</p>
                <p className="font-semibold text-green-600">{formatCurrency(calculationResult.netToHeirs)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Effective Rate</p>
                <p className="font-semibold">{formatPercentage(calculationResult.effectiveRate)}</p>
              </div>
            </div>
            {calculationResult.liquidityGap > 0 && (
              <Alert className="mt-3 border-yellow-200 bg-yellow-50/50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs">
                  Liquidity gap of {formatCurrency(calculationResult.liquidityGap)} detected. 
                  Consider life insurance or asset reallocation strategies.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {scenario ? 'Update Scenario' : 'Create Scenario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}