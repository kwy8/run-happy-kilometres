import { QrCode, PencilLine, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ResultSource = "qr" | "manual" | null | undefined;

interface Props {
  source: ResultSource;
  status?: string | null;
  hasProof?: boolean;
}

export function SourceBadge({ source, status, hasProof }: Props) {
  if (!source) return null;
  const isQr = source === "qr";
  const label = isQr ? "QR" : "Manual";
  const Icon = isQr ? QrCode : PencilLine;
  const variant = status === "verified" ? "default" : status === "rejected" ? "destructive" : "secondary";

  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1 font-normal">
            <Icon className="w-3 h-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {isQr ? "Timed via QR scan" : "Manually submitted by runner"}
            {status && status !== "verified" ? ` · ${status}` : ""}
          </p>
        </TooltipContent>
      </Tooltip>
      {hasProof && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Paperclip className="w-3 h-3 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent><p className="text-xs">Proof attached</p></TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
