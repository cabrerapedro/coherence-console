import Link from "next/link";
import {
  ArrowUpRight,
  Database,
  DollarSign,
  Gauge,
  LineChart,
  ListChecks,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDatasetStats } from "@/lib/db";
import { NAV_CARDS, PAGES, SITE } from "@/lib/ui-copy";

export const dynamic = "force-dynamic";

const SONNET_AVG_FALLBACK_USD = 0.012;
const SONNET_MODEL = "anthropic/claude-sonnet-4-6";

export default async function HomePage() {
  const stats = await getDatasetStats();
  const escalationRate =
    stats.finalClassifications > 0 ? stats.escalationCount / stats.finalClassifications : 0;
  const sonnetRow = stats.byModel.find((m) => m.model === SONNET_MODEL);
  const sonnetAvg = sonnetRow && sonnetRow.calls > 0 ? sonnetRow.avgCost : SONNET_AVG_FALLBACK_USD;
  const saved = sonnetAvg * stats.totalActions - stats.totalCostUsd;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="space-y-2 pt-4">
          <Badge variant="secondary" className="font-mono">
            v1 · 80 actions · ALOHAS demo
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {PAGES.home.title}
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            {SITE.tagline}
          </p>
          <p className="max-w-3xl pt-2 text-sm text-muted-foreground">{PAGES.home.subtitle}</p>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniStat
            icon={Database}
            value={stats.totalActions.toString()}
            label="actions in dataset"
          />
          <MiniStat
            icon={DollarSign}
            value={`$${stats.totalCostUsd.toFixed(4)}`}
            label="spent classifying"
          />
          <MiniStat
            icon={Gauge}
            value={`${(escalationRate * 100).toFixed(1)}%`}
            label="escalated to Sonnet"
          />
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Open a view
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NavCard
              href="/review"
              icon={ListChecks}
              title={NAV_CARDS.review.title}
              description={NAV_CARDS.review.description}
              cta={NAV_CARDS.review.cta}
            />
            <NavCard
              href="/evals"
              icon={LineChart}
              title={NAV_CARDS.evals.title}
              description={NAV_CARDS.evals.description}
              cta={NAV_CARDS.evals.cta}
            />
            <NavCard
              href="/stats"
              icon={Gauge}
              title={NAV_CARDS.stats.title}
              description={NAV_CARDS.stats.description}
              cta={NAV_CARDS.stats.cta}
            />
            <NavCard
              href="/upload"
              icon={Upload}
              title={NAV_CARDS.upload.title}
              description={NAV_CARDS.upload.description}
              cta={NAV_CARDS.upload.cta}
              accent
            />
          </div>
        </section>

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{SITE.footer}</span>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/cabrerapedro/coherence-console"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Source on GitHub
              </a>
              <span className="opacity-30">·</span>
              <a
                href="https://github.com/cabrerapedro/coherence-console/blob/main/docs/findings_block_full.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Findings doc
              </a>
              <span className="opacity-30">·</span>
              <span>
                Cost saved vs Sonnet-only:{" "}
                <span className="font-mono text-foreground">${saved.toFixed(2)}</span>
              </span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 px-5 py-4">
        <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NavCard({
  href,
  icon: Icon,
  title,
  description,
  cta,
  accent = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={`group transition-colors hover:border-foreground/30 ${accent ? "border-foreground/20 bg-secondary/30" : ""}`}
    >
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
          <Icon className="size-4" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground transition-opacity hover:opacity-70"
        >
          {cta}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
