import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, TrendingUp, Shield, DollarSign, Calculator, Sparkles } from 'lucide-react';

interface ValueTeaserCardProps {
  title: string;
  value: string;
  description: string;
  linkTo: string;
  linkText: string;
  icon?: 'trending' | 'shield' | 'dollar' | 'calculator';
  className?: string;
  variant?: 'default' | 'accent';
}

const iconMap = {
  trending: TrendingUp,
  shield: Shield,
  dollar: DollarSign,
  calculator: Calculator,
};

export function ValueTeaserCard({
  title,
  value,
  description,
  linkTo,
  linkText,
  icon = 'trending',
  className,
  variant = 'default',
}: ValueTeaserCardProps) {
  const Icon = iconMap[icon];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-6 transition-all duration-500',
        'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
        'border hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1',
        variant === 'accent' && 'from-purple-900/40 via-indigo-900/40 to-blue-900/40 border-purple-600/50',
        'backdrop-blur-xl',
        className
      )}
    >
      {/* Animated background gradients */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className={cn(
            'p-3 rounded-xl shadow-lg',
            variant === 'default' ? 'bg-gray-800/70' : 'bg-gradient-to-br from-purple-800/50 to-blue-800/50'
          )}>
            <Icon className={cn(
              'h-6 w-6',
              variant === 'default' ? 'text-gray-300' : 'text-white'
            )} />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>

        <div className="mb-5">
          <p className={cn(
            'text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent',
            variant === 'default' 
              ? 'from-gray-100 to-gray-300' 
              : 'from-purple-300 via-pink-300 to-indigo-300'
          )}>
            {value}
          </p>
          <p className="text-sm text-gray-300 mt-3 leading-relaxed">{description}</p>
        </div>

        <button
          onClick={() => window.location.href = linkTo}
          className={cn(
            'inline-flex items-center px-4 py-2.5 rounded-lg font-medium transition-all group',
            'bg-gradient-to-r hover:shadow-lg transform hover:scale-105',
            variant === 'default' 
              ? 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white' 
              : 'from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
          )}
        >
          {linkText}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}

interface ValueTeaserInlineProps {
  value: string;
  description: string;
  linkTo: string;
  className?: string;
}

export function ValueTeaserInline({
  value,
  description,
  linkTo,
  className,
}: ValueTeaserInlineProps) {
  return (
    <button 
      onClick={() => window.location.href = linkTo}
      className={cn(
        'group inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50',
        'transition-all duration-300 hover:from-purple-900/40 hover:to-blue-900/40',
        'hover:border-purple-600 hover:shadow-lg hover:shadow-purple-500/20',
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
      <span className="text-xs">
        <span className="font-semibold text-purple-300">{value}</span>
        <span className="text-gray-400 ml-1">{description}</span>
      </span>
      <ArrowRight className="h-3 w-3 text-purple-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}