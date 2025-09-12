import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingDown,
  Trophy,
  Calendar,
  Target,
  CheckCircle,
  Clock,
  DollarSign,
  Award,
  Zap,
  Star,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Activity
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number;
  originalBalance?: number;
  annualInterestRate: number;
  minimumPayment: number;
  status: string;
}

interface PayoffPlan {
  id: number;
  planName: string;
  strategy: string;
  payoffDate: string;
  totalInterestPaid: number;
  monthsToPayoff: number;
  isActive: boolean;
}

interface Milestone {
  id: string;
  type: string;
  title: string;
  description: string;
  achievedAt?: Date;
  icon: any;
  color: string;
  xp: number;
}

interface ProgressTrackingProps {
  debts: Debt[];
  activePlan: PayoffPlan | null;
}

export function ProgressTracking({ debts, activePlan }: ProgressTrackingProps) {
  const [selectedView, setSelectedView] = useState<'timeline' | 'charts' | 'milestones'>('timeline');
  
  const activeDebts = debts.filter(d => d.status === 'active');
  const paidOffDebts = debts.filter(d => d.status === 'paid_off');
  const totalOriginalDebt = debts.reduce((sum, d) => sum + (d.originalBalance || d.currentBalance), 0);
  const totalCurrentDebt = activeDebts.reduce((sum, d) => sum + d.currentBalance, 0);
  const totalPaidOff = totalOriginalDebt - totalCurrentDebt;
  const progressPercentage = totalOriginalDebt > 0 ? (totalPaidOff / totalOriginalDebt) * 100 : 0;

  // Mock milestones
  const milestones: Milestone[] = [
    {
      id: '1',
      type: 'first_debt',
      title: 'First Debt Eliminated',
      description: 'Paid off your first debt!',
      achievedAt: paidOffDebts.length > 0 ? new Date() : undefined,
      icon: Trophy,
      color: 'text-yellow-400',
      xp: 100
    },
    {
      id: '2',
      type: 'percentage',
      title: '25% Debt Free',
      description: 'Reduced total debt by 25%',
      achievedAt: progressPercentage >= 25 ? new Date() : undefined,
      icon: Target,
      color: 'text-blue-400',
      xp: 150
    },
    {
      id: '3',
      type: 'percentage',
      title: '50% Debt Free',
      description: 'Halfway to financial freedom!',
      achievedAt: progressPercentage >= 50 ? new Date() : undefined,
      icon: Zap,
      color: 'text-purple-400',
      xp: 250
    },
    {
      id: '4',
      type: 'percentage',
      title: '75% Debt Free',
      description: 'Almost there! 75% debt eliminated',
      achievedAt: progressPercentage >= 75 ? new Date() : undefined,
      icon: Star,
      color: 'text-orange-400',
      xp: 350
    },
    {
      id: '5',
      type: 'complete',
      title: 'Debt Freedom',
      description: 'All debts paid off!',
      achievedAt: activeDebts.length === 0 && paidOffDebts.length > 0 ? new Date() : undefined,
      icon: Award,
      color: 'text-green-400',
      xp: 500
    }
  ];

  const achievedMilestones = milestones.filter(m => m.achievedAt);
  const totalXP = achievedMilestones.reduce((sum, m) => sum + m.xp, 0);

  // Chart data
  const debtBalanceData = {
    labels: debts.map(d => d.debtName),
    datasets: [
      {
        label: 'Original Balance',
        data: debts.map(d => d.originalBalance || d.currentBalance),
        backgroundColor: 'rgba(138, 0, 196, 0.5)',
        borderColor: 'rgba(138, 0, 196, 1)',
        borderWidth: 1,
      },
      {
        label: 'Current Balance',
        data: debts.map(d => d.status === 'active' ? d.currentBalance : 0),
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      }
    ]
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: 'white'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255, 255, 255, 0.7)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        ticks: { 
          color: 'rgba(255, 255, 255, 0.7)',
          callback: (value) => formatCurrency(Number(value))
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const debtTypeData = {
    labels: ['Paid Off', 'Remaining'],
    datasets: [{
      data: [totalPaidOff, totalCurrentDebt],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
      borderColor: [
        'rgba(34, 197, 94, 1)',
        'rgba(239, 68, 68, 1)',
      ],
      borderWidth: 1,
    }]
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: 'white'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.label}: ${formatCurrency(context.parsed)}`;
          }
        }
      }
    }
  };

  // Timeline data
  const timelineEvents = [
    ...paidOffDebts.map(debt => ({
      date: new Date(), // In real app, this would be debt.paidOffDate
      type: 'paid_off',
      title: `${debt.debtName} Paid Off`,
      amount: debt.originalBalance || debt.currentBalance,
      icon: CheckCircle,
      color: 'text-green-400'
    })),
    ...activeDebts.map(debt => ({
      date: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000), // Mock future dates
      type: 'projected',
      title: `${debt.debtName} Payoff`,
      amount: debt.currentBalance,
      icon: Target,
      color: 'text-blue-400'
    }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>Debt Elimination Progress</span>
            <Badge className="bg-primary/20 text-primary border-primary/50">
              {progressPercentage.toFixed(0)}% Complete
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercentage} className="h-4" />
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(totalPaidOff)}
              </p>
              <p className="text-sm text-gray-400">Paid Off</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(totalCurrentDebt)}
              </p>
              <p className="text-sm text-gray-400">Remaining</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(totalOriginalDebt)}
              </p>
              <p className="text-sm text-gray-400">Total Debt</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Selection */}
      <div className="flex gap-2">
        <Button
          variant={selectedView === 'timeline' ? 'default' : 'outline'}
          className={selectedView === 'timeline' ? 'bg-primary' : ''}
          onClick={() => setSelectedView('timeline')}
        >
          <Clock className="w-4 h-4 mr-2" />
          Timeline
        </Button>
        <Button
          variant={selectedView === 'charts' ? 'default' : 'outline'}
          className={selectedView === 'charts' ? 'bg-primary' : ''}
          onClick={() => setSelectedView('charts')}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Charts
        </Button>
        <Button
          variant={selectedView === 'milestones' ? 'default' : 'outline'}
          className={selectedView === 'milestones' ? 'bg-primary' : ''}
          onClick={() => setSelectedView('milestones')}
        >
          <Trophy className="w-4 h-4 mr-2" />
          Milestones
        </Button>
      </div>

      {/* Timeline View */}
      {selectedView === 'timeline' && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Payoff Timeline</CardTitle>
            <CardDescription className="text-gray-400">
              Your journey to debt freedom
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timelineEvents.map((event, index) => {
                const Icon = event.icon;
                return (
                  <div key={index} className="flex items-start gap-4">
                    <div className="relative">
                      <div className={`p-2 bg-gray-900 rounded-full ${event.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {index < timelineEvents.length - 1 && (
                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-16 bg-gray-700" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">{event.title}</p>
                          <p className="text-sm text-gray-400">
                            {event.date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white">
                            {formatCurrency(event.amount)}
                          </p>
                          {event.type === 'paid_off' && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                              Completed
                            </Badge>
                          )}
                          {event.type === 'projected' && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                              Projected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts View */}
      {selectedView === 'charts' && (
        <div className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Debt Balance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Bar data={debtBalanceData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Progress Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Doughnut data={debtTypeData} options={doughnutOptions} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <TrendingDown className="w-5 h-5 text-green-400" />
                      <span className="text-white">Debt Reduction Rate</span>
                    </div>
                    <span className="font-semibold text-green-400">
                      {formatCurrency(totalPaidOff / 12)}/mo
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-blue-400" />
                      <span className="text-white">Average Payment</span>
                    </div>
                    <span className="font-semibold text-blue-400">
                      {formatCurrency(activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0))}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-purple-400" />
                      <span className="text-white">Est. Freedom Date</span>
                    </div>
                    <span className="font-semibold text-purple-400">
                      {activePlan ? new Date(activePlan.payoffDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: 'numeric' 
                      }) : 'Not Set'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Milestones View */}
      {selectedView === 'milestones' && (
        <div className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Achievement Milestones</span>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                  {totalXP} XP Earned
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {milestones.map((milestone) => {
                  const Icon = milestone.icon;
                  const isAchieved = !!milestone.achievedAt;
                  
                  return (
                    <div 
                      key={milestone.id} 
                      className={`p-4 rounded-lg border ${
                        isAchieved 
                          ? 'bg-green-900/20 border-green-800/50' 
                          : 'bg-gray-900 border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 bg-gray-800 rounded-lg ${milestone.color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {milestone.title}
                            </p>
                            <p className="text-sm text-gray-400">
                              {milestone.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {isAchieved ? (
                            <>
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Achieved
                              </Badge>
                              <p className="text-xs text-gray-400 mt-1">
                                +{milestone.xp} XP
                              </p>
                            </>
                          ) : (
                            <Badge className="bg-gray-700 text-gray-400 border-gray-600">
                              Locked
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Next Milestone */}
          {milestones.find(m => !m.achievedAt) && (
            <Card className="bg-gradient-to-r from-purple-900/20 to-gray-800 border-purple-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Next Milestone
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const nextMilestone = milestones.find(m => !m.achievedAt);
                  if (!nextMilestone) return null;
                  const Icon = nextMilestone.icon;
                  
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-8 h-8 ${nextMilestone.color}`} />
                        <div>
                          <p className="font-semibold text-white">
                            {nextMilestone.title}
                          </p>
                          <p className="text-sm text-gray-400">
                            Reward: {nextMilestone.xp} XP
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}