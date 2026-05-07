import { cookies } from "next/headers";
import { AlertTriangle } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDatasetActionCount, uploadPrefixForSession, UPLOAD_GLOBAL_PREFIX } from "@/lib/db";
import { UPLOAD } from "@/lib/ui-copy";
import { UPLOAD_SESSION_COOKIE } from "@/middleware";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

const GLOBAL_UPLOAD_CAP = 100;

export default async function UploadPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(UPLOAD_SESSION_COOKIE)?.value ?? null;
  const [mineSoFar, globalSoFar] = await Promise.all([
    sessionId ? getDatasetActionCount(uploadPrefixForSession(sessionId)) : 0,
    getDatasetActionCount(UPLOAD_GLOBAL_PREFIX),
  ]);
  const remaining = Math.max(0, GLOBAL_UPLOAD_CAP - globalSoFar);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{UPLOAD.pageTitle}</h1>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {mineSoFar} from your session
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {globalSoFar} / {GLOBAL_UPLOAD_CAP} demo capacity
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{UPLOAD.pageSubtitle}</p>
        </header>

        <section className="mt-6">
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4" />
                <CardTitle className="text-sm font-semibold">{UPLOAD.warningTitle}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-amber-900/80 dark:text-amber-200/80">
              {UPLOAD.warningBody}
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 space-y-3">
          <p className="text-xs text-muted-foreground">{UPLOAD.formatHelp}</p>
          <p className="text-xs text-muted-foreground">{UPLOAD.classifyHint}</p>
        </section>

        <section className="mt-6">
          {remaining === 0 ? (
            <Card className="border-amber-500/40">
              <CardContent className="px-6 py-8 text-sm">
                Demo capacity reached: {globalSoFar} of {GLOBAL_UPLOAD_CAP} uploaded actions.
                The 80-action included dataset remains fully reviewable on{" "}
                <a href="/review" className="underline underline-offset-2 hover:text-foreground">
                  /review
                </a>
                .
              </CardContent>
            </Card>
          ) : (
            <UploadForm remainingCapacity={remaining} />
          )}
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Note: each browser session gets an isolated namespace for its uploads via a separate
          cookie (<code className="font-mono text-foreground">coherence_upload_session</code>).
          Other reviewers see only their own &quot;Your cases&quot; on /review. The demo&apos;s
          /stats and /evals only count the included <code className="font-mono">aloha-</code>
          dataset, never any uploads.
        </p>
      </main>
    </>
  );
}
