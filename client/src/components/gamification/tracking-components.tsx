import React from 'react';
import { useGamification } from './gamification-wrapper';

// Button that tracks clicks as actions
interface TrackingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  actionType: string;
  actionTarget?: string;
  actionValue?: number;
  celebrationText?: string;
  xpReward?: number;
}

export const TrackingButton: React.FC<TrackingButtonProps> = ({
  actionType,
  actionTarget,
  actionValue = 1,
  celebrationText,
  xpReward,
  onClick,
  children,
  type = "button", // Explicitly handle the type prop with a default
  ...props
}) => {
  const { trackAction, addMicroCelebration } = useGamification();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (type !== "submit") {
      e.preventDefault(); // Prevent any default form submission behavior except for submit buttons
    }
    // Track the action
    trackAction(actionType, actionTarget, actionValue);
    
    // Show micro celebration if specified
    if (celebrationText) {
      const rect = e.currentTarget.getBoundingClientRect();
      addMicroCelebration(
        celebrationText,
        xpReward,
        {
          x: rect.left + rect.width / 2,
          y: rect.top
        }
      );
    }

    // Call original onClick handler
    onClick?.(e);
  };

  return (
    <button type={type} {...props} onClick={handleClick}>
      {children}
    </button>
  );
};

// Link that tracks navigation as actions
interface TrackingLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  actionType: string;
  actionTarget?: string;
  celebrationText?: string;
}

export const TrackingLink: React.FC<TrackingLinkProps> = ({
  actionType,
  actionTarget,
  celebrationText,
  onClick,
  children,
  ...props
}) => {
  const { trackAction, addMicroCelebration } = useGamification();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Track the action
    trackAction(actionType, actionTarget);
    
    // Show micro celebration if specified
    if (celebrationText) {
      const rect = e.currentTarget.getBoundingClientRect();
      addMicroCelebration(
        celebrationText,
        undefined,
        {
          x: rect.left + rect.width / 2,
          y: rect.top
        }
      );
    }

    // Call original onClick handler
    onClick?.(e);
  };

  return (
    <a {...props} onClick={handleClick}>
      {children}
    </a>
  );
};

// Form that tracks submissions
interface TrackingFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  actionType: string;
  actionTarget?: string;
  celebrationText?: string;
  xpReward?: number;
}

export const TrackingForm: React.FC<TrackingFormProps> = ({
  actionType,
  actionTarget,
  celebrationText,
  xpReward,
  onSubmit,
  children,
  ...props
}) => {
  const { trackAction, addMicroCelebration } = useGamification();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Track the action
    trackAction(actionType, actionTarget);
    
    // Show micro celebration if specified
    if (celebrationText) {
      addMicroCelebration(celebrationText, xpReward);
    }

    // Call original onSubmit handler
    onSubmit?.(e);
  };

  return (
    <form {...props} onSubmit={handleSubmit}>
      {children}
    </form>
  );
};

// Input that tracks when focused (engagement)
interface TrackingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  actionType?: string;
  trackFocus?: boolean;
  trackChange?: boolean;
}

export const TrackingInput: React.FC<TrackingInputProps> = ({
  actionType = 'form-interaction',
  trackFocus = true,
  trackChange = false,
  onFocus,
  onChange,
  ...props
}) => {
  const { trackAction, section } = useGamification();

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (trackFocus) {
      trackAction(actionType, section);
    }
    onFocus?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (trackChange) {
      trackAction('form-data-entry', section);
    }
    onChange?.(e);
  };

  return (
    <input
      {...props}
      onFocus={handleFocus}
      onChange={handleChange}
    />
  );
};

// Section that tracks scrolling/viewing
interface TrackingSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  actionType: string;
  trackView?: boolean;
  trackScroll?: boolean;
  celebrationText?: string;
}

export const TrackingSection: React.FC<TrackingSectionProps> = ({
  actionType,
  trackView = true,
  trackScroll = false,
  celebrationText,
  children,
  ...props
}) => {
  const { trackAction, section } = useGamification();
  const [hasViewed, setHasViewed] = React.useState(false);
  const [hasScrolled, setHasScrolled] = React.useState(false);
  const sectionRef = React.useRef<HTMLDivElement>(null);

  // Track when section comes into view
  React.useEffect(() => {
    if (!trackView || hasViewed) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackAction(actionType, section);
          setHasViewed(true);
          if (celebrationText) {
            // addMicroCelebration(celebrationText);
          }
        }
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [trackView, hasViewed, actionType, section, trackAction, celebrationText]);

  // Track scrolling within section
  const handleScroll = () => {
    if (trackScroll && !hasScrolled) {
      trackAction('section-scroll', section);
      setHasScrolled(true);
    }
  };

  return (
    <div
      {...props}
      ref={sectionRef}
      onScroll={trackScroll ? handleScroll : props.onScroll}
    >
      {children}
    </div>
  );
};

// Calculator usage tracker
interface CalculatorTrackerProps {
  calculatorType: string;
  children: React.ReactNode;
}

export const CalculatorTracker: React.FC<CalculatorTrackerProps> = ({
  calculatorType,
  children
}) => {
  const { trackAction, section, addMicroCelebration } = useGamification();
  const [hasUsed, setHasUsed] = React.useState(false);

  const trackCalculatorUse = () => {
    if (!hasUsed) {
      trackAction('calculator-usage', calculatorType);
      addMicroCelebration(`${calculatorType} calculator used!`, 15);
      setHasUsed(true);
    }
  };

  return (
    <div onClick={trackCalculatorUse}>
      {children}
    </div>
  );
};

// Progress milestone tracker
interface MilestoneTrackerProps {
  milestoneType: string;
  threshold: number;
  currentValue: number;
  celebrationText: string;
  xpReward?: number;
  children: React.ReactNode;
}

export const MilestoneTracker: React.FC<MilestoneTrackerProps> = ({
  milestoneType,
  threshold,
  currentValue,
  celebrationText,
  xpReward = 25,
  children
}) => {
  const { trackAction, addMicroCelebration } = useGamification();
  const [milestoneReached, setMilestoneReached] = React.useState(false);

  React.useEffect(() => {
    if (!milestoneReached && currentValue >= threshold) {
      trackAction('milestone-reached', milestoneType);
      addMicroCelebration(celebrationText, xpReward);
      setMilestoneReached(true);
    }
  }, [currentValue, threshold, milestoneReached, trackAction, milestoneType, addMicroCelebration, celebrationText, xpReward]);

  return <>{children}</>;
};

// Time-based engagement tracker
interface TimeEngagementTrackerProps {
  intervalSeconds: number;
  maxIntervals: number;
  celebrationText: string;
  children: React.ReactNode;
}

export const TimeEngagementTracker: React.FC<TimeEngagementTrackerProps> = ({
  intervalSeconds,
  maxIntervals,
  celebrationText,
  children
}) => {
  const { trackAction, section, addMicroCelebration, timeSpent } = useGamification();
  const [intervalsReached, setIntervalsReached] = React.useState(0);

  React.useEffect(() => {
    const intervals = Math.floor(timeSpent / intervalSeconds);
    if (intervals > intervalsReached && intervals <= maxIntervals) {
      trackAction('time-engagement', section, intervals);
      addMicroCelebration(`${celebrationText} (${intervals * intervalSeconds}s)`, 5);
      setIntervalsReached(intervals);
    }
  }, [timeSpent, intervalSeconds, intervalsReached, maxIntervals, trackAction, section, addMicroCelebration, celebrationText]);

  return <>{children}</>;
};

// Feature discovery tracker
interface FeatureDiscoveryProps {
  featureName: string;
  children: React.ReactNode;
}

export const FeatureDiscovery: React.FC<FeatureDiscoveryProps> = ({
  featureName,
  children
}) => {
  const { trackAction, section, addMicroCelebration } = useGamification();
  const [discovered, setDiscovered] = React.useState(false);

  const handleFeatureDiscovery = () => {
    if (!discovered) {
      trackAction('feature-discovery', featureName);
      addMicroCelebration(`Discovered: ${featureName}!`, 10);
      setDiscovered(true);
    }
  };

  return (
    <div onMouseEnter={handleFeatureDiscovery} onFocus={handleFeatureDiscovery}>
      {children}
    </div>
  );
};

export default {
  TrackingButton,
  TrackingLink,
  TrackingForm,
  TrackingInput,
  TrackingSection,
  CalculatorTracker,
  MilestoneTracker,
  TimeEngagementTracker,
  FeatureDiscovery
};