import React from "react";
import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <LoadingSkeleton className="h-5 w-2/5" />
      <LoadingSkeleton className="h-4 w-4/5" />
      <div className="pt-2 flex justify-between items-center">
        <LoadingSkeleton className="h-8 w-24 rounded-lg" />
        <LoadingSkeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}
