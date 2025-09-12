import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminEmailButtonProps {
  onClick: () => void;
  className?: string;
}

export function AdminEmailButton({ onClick, className }: AdminEmailButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn("flex justify-center mt-8 mb-4", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The button - invisible until hovered */}
      <Button
        variant="outline"
        size="lg"
        onClick={onClick}
        className={cn(
          "transition-all duration-300 ease-in-out",
          isHovered 
            ? "opacity-100 scale-100" 
            : "opacity-0 scale-95",
          "bg-purple-900/50 dark:bg-purple-900/70",
          "hover:bg-purple-800 dark:hover:bg-purple-800",
          "border-2 border-purple-600 hover:border-purple-500",
          "text-purple-200 hover:text-white",
          "shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:shadow-[0_0_30px_rgba(147,51,234,0.7)]",
          "backdrop-blur-sm px-8 py-3",
          "font-semibold"
        )}
      >
        <Mail className="h-5 w-5 mr-2" />
        Send Investment Update to All Users
      </Button>
    </div>
  );
}