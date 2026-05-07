import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
};

export function HelpTip({ children, className, side = "top" }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          "inline-flex size-3.5 cursor-help items-center justify-center text-muted-foreground hover:text-foreground",
          className,
        )}
        aria-label="More info"
      >
        <HelpCircle className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-pretty">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
