import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface StyledLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: "primary" | "secondary" | "subtle" | "ghost";
}

export function StyledLink({
  href,
  children,
  className,
  variant = "subtle",
  ...props
}: StyledLinkProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs";
      case "secondary":
        return "bg-sky-100 text-sky-800 hover:bg-sky-200";
      case "ghost":
        return "text-slate-600 hover:text-emerald-700 hover:bg-slate-100";
      case "subtle":
      default:
        return "bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900";
    }
  };

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 no-underline cursor-pointer select-none",
        getVariantStyles(),
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
