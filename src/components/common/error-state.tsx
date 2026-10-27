import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Terjadi Kesalahan",
  message = "Gagal memuat data atau Anda tidak memiliki akses ke halaman ini.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-rose-200 bg-rose-50/60 text-rose-900",
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-3">
        <AlertCircle className="h-6 w-6 stroke-[1.75]" />
      </div>
      <h3 className="text-base font-semibold mb-1 text-rose-900">{title}</h3>
      <p className="text-xs text-rose-700 max-w-md mb-4 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-rose-300 text-rose-800 hover:bg-rose-100 bg-white"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Muat Ulang Data
        </Button>
      )}
    </div>
  );
}
