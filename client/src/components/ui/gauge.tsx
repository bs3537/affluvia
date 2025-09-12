import React from 'react';

interface GaugeProps {
  value: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  valueLabel?: string;
  colors?: {
    low: string;
    medium: string;
    high: string;
  };
  thresholds?: {
    medium: number;
    high: number;
  };
}

export function Gauge({
  value,
  max = 100,
  label,
  size = 'md',
  showValue = true,
  valueLabel,
  colors = {
    low: '#EF4444',
    medium: '#F59E0B',
    high: '#10B981'
  },
  thresholds = {
    medium: 50,
    high: 75
  }
}: GaugeProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  // The gauge spans from -90 degrees (left) to 90 degrees (right), total 180 degrees
  const rotation = (percentage / 100) * 180 - 90;
  
  // Calculate the arc length: half circle with radius 70 = π * 70 ≈ 219.91
  const arcLength = Math.PI * 70;
  
  const getColor = () => {
    const percentValue = (value / max) * 100;
    if (percentValue >= thresholds.high) return colors.high;
    if (percentValue >= thresholds.medium) return colors.medium;
    return colors.low;
  };
  
  const sizeClasses = {
    sm: { container: 'w-32 h-20', text: 'text-2xl', label: 'text-xs' },
    md: { container: 'w-48 h-28', text: 'text-3xl', label: 'text-sm' },
    lg: { container: 'w-64 h-36', text: 'text-4xl', label: 'text-base' }
  };
  
  const sizes = sizeClasses[size];
  const gaugeColor = getColor();
  
  return (
    <div className={`relative ${sizes.container} flex flex-col items-center justify-center`}>
      <svg 
        viewBox="0 0 200 120" 
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'translateY(-10%)' }}
      >
        {/* Background arc */}
        <path
          d="M 30 100 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Color segments for visual reference */}
        <path
          d="M 30 100 A 70 70 0 0 1 65 45"
          fill="none"
          stroke={colors.low}
          strokeWidth="3"
          opacity="0.3"
          strokeLinecap="round"
        />
        <path
          d="M 65 45 A 70 70 0 0 1 135 45"
          fill="none"
          stroke={colors.medium}
          strokeWidth="3"
          opacity="0.3"
          strokeLinecap="round"
        />
        <path
          d="M 135 45 A 70 70 0 0 1 170 100"
          fill="none"
          stroke={colors.high}
          strokeWidth="3"
          opacity="0.3"
          strokeLinecap="round"
        />
        
        {/* Progress arc */}
        <path
          d="M 30 100 A 70 70 0 0 1 170 100"
          fill="none"
          stroke={gaugeColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * arcLength} ${arcLength}`}
          style={{
            filter: `drop-shadow(0 0 8px ${gaugeColor}40)`,
            transition: 'stroke-dasharray 0.5s ease-in-out'
          }}
        />
        
      </svg>
      
      {/* Value display */}
      <div className="relative mt-8 text-center">
        {showValue && (
          <div className={`font-bold text-white ${sizes.text}`}>
            {Math.round(value)}
            {valueLabel && <span className={`${sizes.label} text-gray-400 ml-1`}>{valueLabel}</span>}
          </div>
        )}
        {label && (
          <div className={`${sizes.label} text-gray-400 mt-1`}>{label}</div>
        )}
      </div>
    </div>
  );
}