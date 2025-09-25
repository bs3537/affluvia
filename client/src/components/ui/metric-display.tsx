import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricDisplayProps {
  value: number;
  label?: string;
  format?: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  showSign?: boolean;
}

export function MetricDisplay({
  value,
  label,
  format = 'number',
  trend,
  trendValue,
  size = 'md',
  color = 'neutral',
  icon,
  showSign = false
}: MetricDisplayProps) {
  const sizeClasses = {
    sm: { value: 'text-2xl', label: 'text-xs', trend: 'text-xs' },
    md: { value: 'text-3xl', label: 'text-sm', trend: 'text-sm' },
    lg: { value: 'text-4xl', label: 'text-base', trend: 'text-base' }
  };
  
  const colorClasses = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-white'
  };
  
  const getFormattedValue = () => {
    const sign = showSign && value >= 0 ? '+' : '';
    const negativeSign = value < 0 ? '-' : '';
    
    switch (format) {
      case 'currency':
        const absValue = Math.abs(value);
        if (absValue >= 1000000) {
          const millions = absValue / 1000000;
          return `${negativeSign}${sign}$${millions.toFixed(2)} million`;
        }
        return `${negativeSign}${sign}$${absValue.toLocaleString()}`;
      case 'percentage':
        return `${sign}${value}%`;
      default:
        return `${sign}${value.toLocaleString()}`;
    }
  };
  
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'neutral':
        return <Minus className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };
  
  const sizes = sizeClasses[size];
  const valueColor = color === 'neutral' && value < 0 ? 'text-red-400' : colorClasses[color];
  
  return (
    <div className="flex flex-col items-center">
      {icon && (
        <div className="mb-2">
          {icon}
        </div>
      )}
      
      <div className={`${sizes.value} font-bold ${valueColor} transition-all duration-300`}>
        {getFormattedValue()}
      </div>
      
      {label && (
        <div className={`${sizes.label} text-gray-400 mt-1`}>
          {label}
        </div>
      )}
      
      {trend && (trend || trendValue) && (
        <div className="flex items-center gap-2 mt-2">
          {getTrendIcon()}
          {trendValue && (
            <span className={`${sizes.trend} ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
