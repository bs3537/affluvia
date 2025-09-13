import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  valueFormat?: 'percentage' | 'fraction' | 'currency';
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'danger';
  animated?: boolean;
  gradientColor?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  valueFormat = 'percentage',
  size = 'md',
  color = 'default',
  animated = true,
  gradientColor = true
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const sizeClasses = {
    sm: { bar: 'h-2', container: 'h-2', text: 'text-xs' },
    md: { bar: 'h-3', container: 'h-3', text: 'text-sm' },
    lg: { bar: 'h-4', container: 'h-4', text: 'text-base' }
  };
  
  const colorClasses = {
    default: 'bg-gradient-to-r from-purple-500 to-purple-600',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600',
    warning: 'bg-gradient-to-r from-yellow-500 to-amber-600',
    danger: 'bg-gradient-to-r from-red-500 to-rose-600'
  };
  
  const getAutoColor = () => {
    if (!gradientColor) return colorClasses[color];
    if (percentage >= 75) return colorClasses.success;
    if (percentage >= 50) return colorClasses.warning;
    return colorClasses.danger;
  };
  
  const formatValue = () => {
    switch (valueFormat) {
      case 'percentage':
        return `${Math.round(percentage)}%`;
      case 'fraction':
        return `${Math.round(value)}/${Math.round(max)}`;
      case 'currency':
        return `$${value.toLocaleString()}`;
      default:
        return `${Math.round(percentage)}%`;
    }
  };
  
  const sizes = sizeClasses[size];
  
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className={`${sizes.text} text-gray-300`}>{label}</span>}
          {showValue && <span className={`${sizes.text} font-semibold text-white`}>{formatValue()}</span>}
        </div>
      )}
      <div className={`${sizes.container} bg-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm`}>
        <div
          className={`${sizes.bar} ${getAutoColor()} rounded-full transition-all duration-700 ease-out relative overflow-hidden`}
          style={{ width: `${percentage}%` }}
        >
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>
      </div>
    </div>
  );
}

const shimmerAnimation = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('progress-bar-animations')) {
  const style = document.createElement('style');
  style.id = 'progress-bar-animations';
  style.textContent = shimmerAnimation;
  document.head.appendChild(style);
}