import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, Trophy, Target, AlertCircle } from 'lucide-react';

interface SessionTrackerProps {
  currentStep: number;
  totalSteps: number;
  onMomentumBoost: () => void;
}

export function SessionTracker({ currentStep, totalSteps, onMomentumBoost }: SessionTrackerProps) {
  const [sessionTime, setSessionTime] = useState(0);
  const [momentum, setMomentum] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(prev => prev + 1);
      
      // Check for inactivity (momentum decay)
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      
      if (timeSinceActivity > 60000) { // 1 minute of inactivity
        setMomentum(prev => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastActivity]);

  // Update activity timestamp when step changes
  useEffect(() => {
    setLastActivity(Date.now());
    
    // Boost momentum on step completion
    if (currentStep > 1) {
      setMomentum(prev => Math.min(100, prev + 15));
      setStreak(prev => prev + 1);
      
      // Trigger celebration for momentum milestones
      if (momentum >= 75) {
        onMomentumBoost();
      }
    }
  }, [currentStep]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressCategory = () => {
    const progress = (currentStep / totalSteps) * 100;
    if (progress < 25) return { label: 'Getting Started', color: 'bg-blue-500', urgency: 'low' };
    if (progress < 50) return { label: 'Building Momentum', color: 'bg-yellow-500', urgency: 'medium' };
    if (progress < 75) return { label: 'On Fire!', color: 'bg-orange-500', urgency: 'high' };
    return { label: 'Almost There!', color: 'bg-green-500', urgency: 'critical' };
  };

  const getUrgencyMessage = () => {
    const progress = (currentStep / totalSteps) * 100;
    const timeMinutes = Math.floor(sessionTime / 60);
    
    if (timeMinutes < 5) {
      return "🚀 Great start! Keep your momentum going";
    } else if (timeMinutes < 10 && progress < 50) {
      return "⚡ You're in the zone - don't lose steam now!";
    } else if (timeMinutes < 15 && progress < 75) {
      return "🔥 Halfway there! Finish strong in one session";
    } else if (progress > 75) {
      return "🏁 So close! Complete your financial profile now";
    } else {
      return "⏰ You've invested time - complete it while fresh in mind";
    }
  };

  const category = getProgressCategory();

  return (
    <Card className="bg-gray-800/50 border-gray-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#B040FF]" />
          <span className="text-white font-medium">Session Time: {formatTime(sessionTime)}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <Badge variant="secondary" className="bg-orange-600/20 text-orange-400 border-orange-600/30">
              <Zap className="w-3 h-3 mr-1" />
              {streak} streak
            </Badge>
          )}
          
          <Badge className={`${category.color} text-white border-0`}>
            <Target className="w-3 h-3 mr-1" />
            {category.label}
          </Badge>
        </div>
      </div>

      {/* Momentum Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-400">Session Momentum</span>
          <span className="text-xs text-[#B040FF] font-medium">{momentum}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-[#B040FF] to-[#8A00C4] h-2 rounded-full transition-all duration-500"
            style={{ width: `${momentum}%` }}
          />
        </div>
      </div>

      {/* Urgency Message */}
      <div className="flex items-start gap-2 text-sm">
        <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
        <span className="text-gray-300">{getUrgencyMessage()}</span>
      </div>

      {/* Session Persistence Warning */}
      {sessionTime > 300 && currentStep < totalSteps && (
        <div className="mt-3 p-2 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-yellow-200">
              You've invested {Math.floor(sessionTime / 60)} minutes - complete now to maximize your progress!
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}