import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface ActivityFeedProps {
  currentStep: number;
}

interface ActivityItem {
  id: string;
  message: string;
  timestamp: Date;
  type: 'completion' | 'milestone' | 'trend';
}

export function ActivityFeed({ currentStep }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activeUsers, setActiveUsers] = useState(127);

  // Simulated activity feed
  useEffect(() => {
    const generateActivity = () => {
      const messages = [
        "Someone just completed their financial profile! 🎉",
        "A user improved their emergency fund to 6 months",
        "Financial profile completion rate up 23% today",
        "Someone just unlocked 'Planning Pro' achievement",
        "A user discovered they can save $2,400 annually",
        "New record: 89% completion rate this hour",
        "Someone just calculated their retirement readiness"
      ];

      const types: Array<'completion' | 'milestone' | 'trend'> = ['completion', 'milestone', 'trend'];
      
      const newActivity: ActivityItem = {
        id: Date.now().toString(),
        message: messages[Math.floor(Math.random() * messages.length)],
        timestamp: new Date(),
        type: types[Math.floor(Math.random() * types.length)]
      };

      setActivities(prev => [newActivity, ...prev].slice(0, 5));
    };

    // Generate initial activities
    generateActivity();

    // Add new activity every 15-30 seconds
    const interval = setInterval(() => {
      generateActivity();
      
      // Randomly update active users count
      setActiveUsers(prev => prev + Math.floor(Math.random() * 10) - 5);
    }, Math.random() * 15000 + 15000);

    return () => clearInterval(interval);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'completion': return CheckCircle;
      case 'milestone': return TrendingUp;
      case 'trend': return Users;
      default: return Clock;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'completion': return 'text-green-400';
      case 'milestone': return 'text-[#B040FF]';
      case 'trend': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <Card className="bg-gray-800/20 border-gray-700/50 p-3 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-white font-medium text-xs">Live Activity</span>
        </div>
        
        <Badge variant="secondary" className="bg-green-600/20 text-green-400 text-xs px-2 py-0.5">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse" />
          {activeUsers} active
        </Badge>
      </div>

      {/* Activity Stream */}
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {activities.map(activity => {
          const IconComponent = getActivityIcon(activity.type);
          const iconColor = getActivityColor(activity.type);

          return (
            <div 
              key={activity.id}
              className="flex items-start gap-2 text-xs animate-in slide-in-from-top-2 duration-300"
            >
              <IconComponent className={`w-3 h-3 mt-0.5 flex-shrink-0 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <span className="text-gray-300">{activity.message}</span>
                <div className="text-gray-500 text-xs mt-0.5">
                  {formatTimeAgo(activity.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Encouragement Message */}
      {currentStep >= 6 && (
        <div className="mt-3 pt-2 border-t border-gray-700/50">
          <div className="text-xs text-center text-gray-400">
            🔥 You're in the top 25% of users who reach this step!
          </div>
        </div>
      )}
    </Card>
  );
}