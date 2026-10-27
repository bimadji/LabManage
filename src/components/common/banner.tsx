import React from "react";
import { cn } from "@/lib/utils";

interface BannerProps {
  title: string;
  description: string;
  badgeText?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function Banner({
  title,
  description,
  badgeText,
  action,
  icon,
  className,
}: BannerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-sky-50 to-teal-50 p-5 md:p-6 shadow-xs",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
        <div className="space-y-1.5 max-w-2xl">
          {badgeText && (
            <span className="inline-flex items-center rounded-full bg-emerald-100/90 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 mb-1">
              {badgeText}
            </span>
          )}
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800">
            {title}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {description}
          </p>
        </div>

        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>

      {icon && (
        <div className="absolute right-4 bottom-[-10px] opacity-10 pointer-events-none text-emerald-900">
          {icon}
        </div>
      )}
    </div>
  );
}
