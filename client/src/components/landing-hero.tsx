import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

interface LandingHeroProps {
  onGetStarted: () => void;
}

export function LandingHero({ onGetStarted }: LandingHeroProps) {
  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg opacity-90" />
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="text-center">
          <div className="flex justify-center items-center mb-6">
            <TrendingUp className="w-12 h-12 text-white mr-3" />
            <h1 className="text-4xl md:text-6xl font-bold text-white">AFFLUVIA</h1>
          </div>
          <p className="text-xl md:text-2xl text-white/90 mb-8">
            Empower Your Financial Future with Professional Guidance
          </p>
          <p className="text-lg text-white/80 max-w-3xl mx-auto mb-12">
            AFFLUVIA combines professional financial planning standards with advanced analytics to help you achieve your life goals.
          </p>
          <Button 
            onClick={onGetStarted}
            className="bg-white text-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors hover-lift"
          >
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
}
