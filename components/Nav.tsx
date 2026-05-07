"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ListChecks, LineChart, Gauge, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/review", label: "Review", icon: ListChecks },
  { href: "/evals", label: "Evals", icon: LineChart },
  { href: "/stats", label: "Stats", icon: Gauge },
  { href: "/upload", label: "Upload", icon: Upload },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Activity className="size-4" />
          <span>Coherence Console</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
