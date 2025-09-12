import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Building, 
  Shield,
  DollarSign,
  TrendingUp,
  Info,
  AlertCircle,
  ChevronRight,
  Calculator,
  FileText,
  Users,
  Lock,
  Unlock,
  Phone,
  Mail
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface TrustPlanningProps {
  estatePlanId?: number;
}

export function TrustPlanning({ estatePlanId }: TrustPlanningProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [consultationStrategy, setConsultationStrategy] = useState<any>(null);

  const trustStrategies = [
    {
      id: 'revocable',
      name: 'Revocable Living Trust',
      icon: Unlock,
      description: 'Avoid probate while maintaining control during your lifetime',
      benefits: [
        'Avoids probate delays and costs',
        'Maintains privacy (not public record)',
        'Provides incapacity planning',
        'Can be modified or revoked anytime'
      ],
      drawbacks: [
        'No estate tax benefits',
        'Upfront legal costs',
        'Ongoing administration'
      ],
      bestFor: 'Most people with assets over $150,000',
      taxImpact: 'Neutral - no tax advantages or disadvantages',
      estimatedCost: '$2,000 - $4,000 to establish'
    },
    {
      id: 'irrevocable',
      name: 'Irrevocable Life Insurance Trust (ILIT)',
      icon: Lock,
      description: 'Remove life insurance from taxable estate',
      benefits: [
        'Removes life insurance from estate',
        'Protects benefits from creditors',
        'Can provide liquidity for estate taxes',
        'Generation-skipping benefits'
      ],
      drawbacks: [
        'Cannot be changed once established',
        'Loss of control over policy',
        'Complex administration'
      ],
      bestFor: 'High net worth individuals with large life insurance policies',
      taxImpact: 'Reduces estate tax by removing insurance proceeds',
      estimatedCost: '$3,000 - $5,000 to establish'
    },
    {
      id: 'charitable',
      name: 'Charitable Remainder Trust (CRT)',
      icon: Users,
      description: 'Generate income while supporting charity',
      benefits: [
        'Income tax deduction',
        'Lifetime income stream',
        'Estate tax reduction',
        'Support charitable causes'
      ],
      drawbacks: [
        'Irrevocable commitment',
        'Complex to administer',
        'Remainder goes to charity'
      ],
      bestFor: 'Charitably inclined with appreciated assets',
      taxImpact: 'Income tax deduction plus estate tax reduction',
      estimatedCost: '$5,000 - $10,000 to establish'
    },
    {
      id: 'credit-shelter',
      name: 'Credit Shelter Trust (CST)',
      icon: Shield,
      description: 'Maximize estate tax exemptions for married couples',
      benefits: [
        'Doubles estate tax exemption',
        'Protects assets for heirs',
        'Spouse retains access to income',
        'Asset protection benefits'
      ],
      drawbacks: [
        'Only beneficial for estates over exemption',
        'Complex administration',
        'Income tax considerations'
      ],
      bestFor: 'Married couples with estates over $27.22M (2024)',
      taxImpact: 'Can save millions in estate taxes',
      estimatedCost: '$5,000 - $8,000 to establish'
    },
    {
      id: 'qtip',
      name: 'QTIP Trust',
      icon: FileText,
      description: 'Provide for spouse while controlling ultimate distribution',
      benefits: [
        'Spouse receives lifetime income',
        'Qualifies for marital deduction',
        'Control final beneficiaries',
        'Protects assets from remarriage'
      ],
      drawbacks: [
        'Spouse limited to income only',
        'Complex tax filings',
        'Trustee fees'
      ],
      bestFor: 'Blended families or second marriages',
      taxImpact: 'Defers estate tax until second death',
      estimatedCost: '$4,000 - $6,000 to establish'
    },
    {
      id: 'grat',
      name: 'Grantor Retained Annuity Trust (GRAT)',
      icon: TrendingUp,
      description: 'Transfer appreciation to heirs tax-free',
      benefits: [
        'Transfers asset appreciation tax-free',
        'Grantor retains annuity payments',
        'Minimal gift tax consequences',
        'Works well in low interest environments'
      ],
      drawbacks: [
        'Must survive trust term',
        'No generation-skipping benefits',
        'Requires appreciating assets'
      ],
      bestFor: 'Business owners or those with rapidly appreciating assets',
      taxImpact: 'Removes appreciation from estate',
      estimatedCost: '$5,000 - $10,000 to establish'
    }
  ];

  const renderStrategyDetails = (strategy: typeof trustStrategies[0]) => {
    const Icon = strategy.icon;
    
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <Icon className="h-6 w-6 text-primary" />
            {strategy.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-300">{strategy.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Benefits */}
            <div className="bg-green-900/20 rounded-lg p-4 border border-green-800">
              <h4 className="text-green-400 font-semibold mb-2">Benefits</h4>
              <ul className="space-y-1">
                {strategy.benefits.map((benefit, index) => (
                  <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Drawbacks */}
            <div className="bg-red-900/20 rounded-lg p-4 border border-red-800">
              <h4 className="text-red-400 font-semibold mb-2">Considerations</h4>
              <ul className="space-y-1">
                {strategy.drawbacks.map((drawback, index) => (
                  <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    {drawback}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400 text-sm">Best for:</span>
              <span className="text-white text-sm">{strategy.bestFor}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400 text-sm">Tax impact:</span>
              <span className="text-white text-sm">{strategy.taxImpact}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400 text-sm">Estimated cost:</span>
              <span className="text-white text-sm">{strategy.estimatedCost}</span>
            </div>
          </div>

          <div className="pt-4">
            <Button 
              className="w-full bg-[#8A00C4] hover:bg-[#7000A4]"
              onClick={() => {
                setConsultationStrategy(strategy);
                setShowConsultationModal(true);
              }}
            >
              Get Professional Consultation
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-2">Trust Strategy Planning</h3>
        <p className="text-gray-400">
          Explore trust strategies to protect assets, minimize taxes, and control distributions
        </p>
      </div>

      {/* Important Notice */}
      <Alert className="bg-blue-900/20 border-blue-800">
        <Info className="h-4 w-4 text-blue-300" />
        <AlertTitle className="text-blue-100">Professional Guidance Required</AlertTitle>
        <AlertDescription className="text-gray-300">
          Trust planning is complex and requires professional legal and tax advice. These strategies 
          are presented for educational purposes only. Always consult with an estate planning attorney 
          before implementing any trust strategy.
        </AlertDescription>
      </Alert>

      {/* Trust Strategy Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trustStrategies.map((strategy) => {
          const Icon = strategy.icon;
          const isSelected = selectedStrategy === strategy.id;
          
          return (
            <Card 
              key={strategy.id}
              className={`bg-gray-800/50 border-gray-700 cursor-pointer transition-all hover:border-primary ${
                isSelected ? 'border-primary shadow-lg' : ''
              }`}
              onClick={() => setSelectedStrategy(strategy.id)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {strategy.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">{strategy.description}</p>
                {isSelected && (
                  <Badge className="mt-3 bg-primary/20 text-primary border-primary">
                    Selected
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected Strategy Details */}
      {selectedStrategy && (
        <div className="mt-6">
          {renderStrategyDetails(trustStrategies.find(s => s.id === selectedStrategy)!)}
        </div>
      )}

      {/* Common Trust Considerations */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            Important Trust Considerations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Alert className="bg-gray-700/30 border-gray-600">
              <AlertDescription className="text-gray-300">
                <strong className="text-white">Trustee Selection:</strong> Choose trustees carefully. 
                Consider professional trustees for complex trusts or family dynamics.
              </AlertDescription>
            </Alert>
            
            <Alert className="bg-gray-700/30 border-gray-600">
              <AlertDescription className="text-gray-300">
                <strong className="text-white">State Laws:</strong> Trust laws vary significantly by state. 
                Some states offer better asset protection or tax treatment.
              </AlertDescription>
            </Alert>
            
            <Alert className="bg-gray-700/30 border-gray-600">
              <AlertDescription className="text-gray-300">
                <strong className="text-white">Ongoing Costs:</strong> Factor in annual trustee fees, 
                tax preparation, and administration costs.
              </AlertDescription>
            </Alert>
            
            <Alert className="bg-gray-700/30 border-gray-600">
              <AlertDescription className="text-gray-300">
                <strong className="text-white">Tax Implications:</strong> Trusts may be subject to 
                compressed tax brackets. Plan distributions carefully.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Professional Consultation Modal */}
      <Dialog open={showConsultationModal} onOpenChange={setShowConsultationModal}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-400" />
              Professional Estate Planning Consultation
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Connect with qualified estate planning professionals
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Strategy Summary */}
            {consultationStrategy && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-100 text-base">
                    Interested in: {consultationStrategy.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 text-sm">{consultationStrategy.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100 text-base">What Happens Next?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-900/20 rounded-lg">
                    <Phone className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-100">Initial Consultation</h4>
                    <p className="text-sm text-gray-400">
                      A qualified estate planning attorney will contact you within 24-48 hours to schedule 
                      a consultation to discuss your specific needs and goals.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-900/20 rounded-lg">
                    <FileText className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-100">Document Review</h4>
                    <p className="text-sm text-gray-400">
                      The attorney will review your current estate planning documents and financial 
                      situation to provide personalized recommendations.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-900/20 rounded-lg">
                    <Calculator className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-100">Cost Estimate</h4>
                    <p className="text-sm text-gray-400">
                      You'll receive a transparent cost estimate for implementing your trust strategy 
                      before any work begins. Initial consultations typically range from $250-$500.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Important Notice */}
            <Alert className="border-yellow-800 bg-yellow-900/20">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-gray-300">
                <strong className="text-yellow-400">Important:</strong> This service connects you with 
                independent estate planning attorneys. Affluvia does not provide legal advice. Always 
                verify credentials and ensure any attorney you work with is licensed in your state.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConsultationModal(false)}
              className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
            >
              Cancel
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20 hover:shadow-purple-700/30 transition-all"
              onClick={() => {
                // In a real app, this would submit a consultation request
                alert('Thank you! An estate planning professional will contact you soon.');
                setShowConsultationModal(false);
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Request Consultation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}