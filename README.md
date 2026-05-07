# Coherence Console

A small tool to detect when AI agents drift in production.

While building it, the eval pipeline caught two real failures, one I introduced myself while editing the classifier prompt, and one that single-pass classifiers structurally cannot fix.

Both are documented below as features of the eval, not as bugs of the classifier.

---

## What this does

You upload a small sample of agent actions (up to 20 per upload) via the `/upload` route, or load the included 80-action hand-designed dataset. Each action is classified by Claude Haiku 4.5 with a Sonnet 4.6 fallback on semantic uncertainty, with structured reasoning. A human reviewer walks through the actions on `/review` (one at a time, keyboard-driven), confirming or overriding each verdict; the labels become a golden set. `/evals` shows the history of classifier-vs-golden-set runs over time, and `/stats` shows total cost and the Haiku/Sonnet breakdown. From then on, every prompt change or model upgrade can be evaluated against that golden set with one CLI command (`npm run eval`).

The point is not the classifier. The point is installing the habit of asking the question — *did the agent do the right thing?* — at a cadence and rigor that telemetry tools (Langfuse, Sentry) cannot replicate. Telemetry sees what happened. This sees whether what happened was right.

**Cost: ~$0.0019 per classification on average.** The full 80-action dataset cost **$0.15** to classify end-to-end with the cascade enabled.

---

## Run it

```bash
git clone https://github.com/cabrerapedro/coherence-console
cd coherence-console
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AI_GATEWAY_API_KEY, ACCESS_PASSWORD
npm run migrate -- migrations/0001_initial.sql
npm run migrate -- migrations/0002_unique_actions.sql
npm run seed:eighty
npm run classify:all
npm run eval                  # records the v1 baseline row in eval_runs
npm run dev
```

Then [http://localhost:3000](http://localhost:3000). The deployed version is at [https://coherence-console.vercel.app](https://coherence-console.vercel.app) (password-gated; password supplied separately).

The `/upload` route is the primary entry point for new data; the `seed:*` scripts are for the included demo dataset only.

The four routes:

- `/` — landing view with the first action and a Classify button.
- `/review` — one action at a time, classifier verdict, four-button human override (keyboard 1/2/3/4, ←/→ to navigate).
- `/evals` — table of past eval runs with version, accuracy, precision, recall, cost, escalation rate, and delta vs the next-newer run.
- `/stats` — total actions, total cost, escalation rate, cost saved vs Sonnet-only baseline, and per-model breakdown.

---

## Why this problem

ALOHAS is moving toward AI as operational infrastructure: agents that participate directly in financial, retail, logistics, and decision-making flows. The hardest failure mode in that world is not technical breakage. It is **operational drift** — agents that produce locally reasonable decisions which, taken together, no longer match what the system is supposed to do. The API responds. Workflows complete. Nothing alerts. Coherence erodes silently.

That problem is what motivated the memo accompanying this build, and it is what this tool starts to address. Not by being a complete solution — a single demo cannot be that — but by demonstrating that the smallest meaningful intervention is a weekly process, not a platform.

---

## What the eval caught

While iterating on the classifier prompt, I introduced a regression and the eval pipeline caught it before it shipped.

**The change.** Run 1 of the 7 Block 1 cases produced 6/7 matches against my hand-designed expected outputs. One miss (case 4, "policy-correct refusal of an elderly mother's son") was an architectural gap I chose to preserve. To fix a separate prompt-level ambiguity in another case, I tightened the definition of `autonomy_appropriate` to also flag *under-utilization* of authority, not just exceeding it.

**The regression.** The fix worked for the case it was meant for — but it caused case 5 (PII over-disclosure on a routine status query) to flip from `incorrect` to `correct`. The new sentence about "exercising authority clearly granted at this level" was loose enough that the model now read sharing payment + billing data with the legitimate account holder as appropriate use of L2 authority. Confidence on both runs was high (0.99 → 0.95), so this was not a stochastic flip — it was a cross-instruction interference.

**Why this matters.** This is exactly the failure mode the tool exists to catch. The eval pipeline surfaced a regression that I introduced, in production-style conditions, before the change was pushed. That is the value proposition of the product, demonstrated by the product on its own author.

The regression is preserved as documented behavior. Run 1 reasoning is retained as `is_final = false` rows in `classifications`, alongside the Run 2 verdicts (`is_final = true`). The full diff is captured verbatim in [`docs/findings_block_full.md`](docs/findings_block_full.md).

---

## What the classifier still misses

Case 4 is the second documented failure, and it is more interesting than the first.

**The case.** A son writes asking about his elderly mother's order, which never arrived. He has no authorized-party flag on her account. Per policy, the agent must refuse cross-customer access. The agent in the case does refuse — but with a robotic two-line response, no acknowledgment of the mother's situation, no path forward (e.g., "we can call her directly with her permission", or "she can add you as authorized in 30 seconds").

**Designed verdict.** `needs_review` — policy correct, customer experience poor.

**Haiku's verdict.** `correct`, confidence 0.95.

**The interesting part.** The cascade fired on this case (semantic-uncertainty rule, condition c: policy violation flagged but classification = correct). Sonnet was invoked as a second opinion. **Sonnet also said `correct`, confidence 0.95**, with substantively similar reasoning.

The miss is **cross-model**, not Haiku-specific. A more capable model does not fix it. What this tells us, and what goes into the next iteration of this tool, is that the path forward is not a smarter classifier — it is **decomposing the prompt to evaluate each axis (policy / experience / autonomy) separately**, instead of asking a single LLM call to collapse them into one verdict. That is an architectural decision, not a capability one.

This is the kind of insight that only emerges when you build evals against your own design intent and inspect the disagreements honestly.

---

## How the classifier works

Two-model cascade with a **semantic-uncertainty rule**, not a numeric-confidence rule.

Haiku 4.5 classifies first. Cascade fires to Sonnet 4.6 if **any** of:

```
(a) confidence < 0.7
(b) classification === 'needs_review'
(c) policy_violations is non-empty AND classification === 'correct'
```

The first condition is conventional. The other two are deliberate.

**Condition (b)** exists because `needs_review` itself is a flag that the model is uncertain across two reasonable axes. Forwarding to a more capable model when the model itself admits it is on the boundary is cheap and useful.

**Condition (c)** is the most important one. A high-confidence "correct" verdict that also flags a policy event is exactly the case where a second opinion has the highest expected value: the model is signaling *"I see something policy-relevant, and I think the agent handled it correctly anyway."* That conjunction is where many real-world misses hide. Disagreements between Haiku and Sonnet on these cases are the single most useful signal the pipeline produces.

In the full 80-action run, the cascade fired on **2 cases (2.5% rate)**, adding **$0.027** to the total cost. Both were policy-flagged correct verdicts. Sonnet agreed with Haiku in both cases — including the case 4 miss above, which is what made *cross-model* the right framing.

**Why Haiku 4.5 as primary.** It is the cheapest production-quality model in the Anthropic stack with structured-output reliability, and the cascade exists precisely to handle the cases where Haiku is not enough. Going Sonnet-only would have raised cost ~6× for marginal accuracy gain on the easy 90% of cases. Going Opus-only would have pushed cost beyond what a demo of this scope can justify.

**Why not OpenAI, Gemini, or a smaller open model.** The case is built for ALOHAS, which standardized on Claude. The right architectural decision was to use the stack the user already chose, not the one I might have preferred. Multi-model abstractions ("model router") are a premature optimization at this stage of the product.

---

## What I did NOT use AI for

- **The dataset.** All 80 synthetic actions were hand-designed by me, not generated by Claude. The classifier's value is bounded by the quality of the cases it is evaluated on; auto-generated cases would have produced an auto-generated tool. Cases were designed in 4 blocks (5+2 policy/autonomy violations, 8 ambiguous, 15 incorrect, 50 correct), with made-to-order workflows concentrated in the failure-mode buckets and customer profiles distributed across 21 EU/UK/US markets.

- **The cascade rule.** The semantic-uncertainty rule (conditions b and c above) is a design decision I made after seeing Run 2 produce zero escalations on the full 80-action dataset. The assistant proposed three alternatives — bumping the numeric threshold, OR-ing in `escalation_recommended`, or re-tuning the prompt. None of those were the right call. The rule above came from looking at the pattern of when uncertainty actually mattered, not from the assistant's options.

- **The decision to preserve failures instead of patching them.** When the assistant flagged the regression on case 5, the default path was to revert the prompt fix. I chose to preserve it because the regression itself is the most interesting artifact in the build — it is the proof that the eval works.

- **The schema decisions.** The `is_final` boolean for cascade outputs, the `unique` constraint on `(agent_id, timestamp)` for batch idempotency, the choice to keep `_design_note` in the JSON file but strip it at load time — those came from working through specific failure modes, not from generic best practice.

---

## How I directed Claude Code

The interesting work in this build was not what I told the assistant to do. It was where I stopped it, what I asked twice, and the failures I chose to document instead of hide.

Concrete moments:

- **Before H2** (the first end-to-end slice), I asked the assistant to write a `classify_one.ts` script. The default plan was to wire the classifier directly into the page server action. I forced an isolation step first — call the gateway from a CLI script, against the seeded action, and verify the response shape — before committing to UI integration. That step caught three real wiring issues (model string format, AI SDK v6 usage shape, gateway base URL handling) in about ten minutes. Without it, those issues would have surfaced inside the page render and been twice as expensive to debug.

- **When the assistant proposed editing migration 0001 in place** to add a unique constraint, I asked for migration 0002 instead. The DB had one row of demo data; in-place editing would have been faster and "safe enough." I chose the slower path because preserving migration history is what a senior reader of this repo would expect to see, regardless of demo state.

- **When the prompt fix for case 7 caused a regression on case 5,** I stopped the push and decided to preserve the regression rather than patch it. The assistant's analysis was correct (cross-instruction interference) but its initial framing positioned it as "a regression I introduced that the tool caught" — true but not the strongest reading. The stronger reading, which goes into the README, is that this is evidence single-pass classifiers have a precision ceiling when policy dimensions pull against each other. That reframe is the kind of decision that does not come from the assistant; it comes from connecting the immediate finding back to the architectural argument in the memo.

- **I overrode the assistant's instinct to wire `escalation_recommended` directly into the cascade trigger.** The model self-recommends escalation 24 times across the dataset, mostly on policy-flagged cases. Auto-firing on that flag would have produced 24 escalations and ~$0.10 of additional cost for marginal value. I kept the flag as informational signal surfaced to the human reviewer in the UI, and used a more selective semantic-uncertainty rule for actual cascade triggering. *"Auto-wire every signal the model emits"* is not a senior choice; *"decide which signals deserve action and which deserve display"* is.

- **I asked the assistant to push back when something in the brief looked wrong, and it did.** Three real findings on the first full classification run — `needs_review` always empty, cascade structurally never firing, `escalation_recommended` disconnected from runtime cascade — surfaced before I asked for them. Each came with honest tradeoff options. That is the dynamic I would want with the AI Software Crafter at ALOHAS, not the dynamic of an assistant that executes silently.

---

## Limitations of v1

- **Re-labeling overwrites, it does not version.** `/review` supports clicking "Override" multiple times on the same case; each click replaces the prior label in `golden_set` rather than appending. A versioned schema (`version` + `is_current`) belongs to v2, when multiple reviewers need to track changes in label rationale over time. For a single-reviewer demo, overwrite is the right semantics — track-changes is over-engineering at this stage.

- **The classifier collapses ambiguity.** Out of 8 hand-designed ambiguous cases, the classifier marked **zero** as `needs_review`. All were forced into `correct` or `incorrect` with confidence ≥ 0.85. This is the architectural limit described in "What the classifier still misses" above. The next iteration of this tool would decompose the classification step into per-axis evaluators rather than a single LLM call.

- **Single-tenant, password-gated, no real auth.** This is a demo, not a product. The gate is a single shared secret stored in `ACCESS_PASSWORD` and checked in `middleware.ts` against a hash held in a cookie. A real deployment needs proper authentication, per-team isolation, and audit logging; all deliberately scoped out.

- **Uploaded data is shared across all viewers of the demo URL, with a global hard cap of 100 actions across all sessions.** Per-reviewer isolation is implemented via cookie-tagged `agent_id` prefixes (`upload-<sessionId>-...`) so `/stats` and `/evals` stay clean for the included dataset and each reviewer sees only their own uploaded actions in `/review`'s "Your cases" tab. For a real product this would be replaced with proper auth + DB-level row-level security.

- **No Langfuse instrumentation in v1.** This tool would benefit from the same observability discipline it argues for. Wiring Langfuse on every classifier call is in "next 4 hours" below.

- **The first eval row is a synthetic baseline.** `golden_set` starts empty (no human has labeled anything yet). The `/evals` page renders `—` for accuracy/precision/recall on synthetic-baseline rows because comparing the classifier against itself produces a trivial 1.000 that would mislead. After someone labels a few entries via `/review` and re-runs `npm run eval`, real metrics appear.

---

## What I would ship in another 4 hours

In rough priority order:

1. **Per-axis classifier decomposition.** Three smaller LLM calls (policy / experience / autonomy) instead of one consolidated call. Combine results into a single verdict downstream. Directly addresses the case 4 failure mode and likely produces meaningful `needs_review` outputs on ambiguous cases.

2. **Langfuse on every classifier call.** Same observability we argue for in the memo, applied to this tool's own behavior.

3. **A diff view between eval runs.** Currently the snapshot file (`data/classifications_v1_block_full.json`) supports diffing manually. A small UI on `/evals` that highlights which cases moved between two runs — and what reasoning shifted — would make the regression-detection workflow self-evident to a non-technical reader.

4. **A weekly digest export.** One page, the 50 actions reviewed that week, the eval result, the diff vs prior week. Email-friendly. This is the artifact a real ALOHAS team would consume; the rest of the tool is the engine that produces it.

5. **Per-session retention policy + automatic cleanup of uploaded data after the demo cap is reached.** Currently upload data persists in the demo DB up to a global cap of 100 actions; for any real use, this would be replaced with per-tenant isolation and time-bounded retention windows.

---

## Repo orientation

```
app/
  page.tsx                            # Console landing: hero + 4 nav cards + footer
  layout.tsx                          # Root layout, metadata, fonts, TooltipProvider
  globals.css                         # Tailwind v4 + shadcn neutral OKLCH theme
  login/page.tsx                      # Demo password gate
  review/page.tsx                     # Per-action review (server shell, source tabs)
  review/ReviewActions.tsx            # Client: 4 buttons + keyboard shortcuts
  review/ClassifyPendingButton.tsx    # Client: classify uploaded actions iteratively
  evals/page.tsx                      # Eval-run history table
  stats/page.tsx                      # Cost + escalation breakdown
  upload/page.tsx                     # Upload UI shell with warning + capacity badges
  upload/UploadForm.tsx               # Client: drag-drop + paste + validate + classify
  api/auth/route.ts                   # POST password → set coherence_auth cookie
  api/review/route.ts                 # POST upsert into golden_set
  api/upload/route.ts                 # POST validate + prefix + insert (no sync classify)
  api/classify-one/route.ts           # POST classify a single uploaded action by id
  api/pending-uploads/route.ts        # GET unclassified action_ids for the session
middleware.ts                         # Auth gate + per-session cookie minting
components/
  Nav.tsx                             # Top nav with active-route highlight
  HelpTip.tsx                         # (?) icon → tooltip helper
  ClassificationBadge.tsx             # Color-coded verdict pill (correct/incorrect/needs_review)
  ui/                                 # shadcn primitives (Button, Card, Tooltip, Table, ...)
lib/
  classifier.ts                       # Single source of truth for the LLM call + cascade rule
  db.ts                               # All Neon queries (no scattered driver imports)
  pricing.ts                          # Token-usage cost calculation
  auth.ts                             # Web-Crypto password hashing + timing-safe compare
  ui-copy.ts                          # All subtitles + tooltip strings + nav-card copy
  utils.ts                            # cn() class-merge helper (clsx + tailwind-merge)
scripts/
  migrate.ts                          # Apply a SQL migration file via the Neon Pool
  seed_one.ts                         # Single-action seed (smoke test for DB write path)
  seed_eighty.ts                      # Batch loader for the synthetic dataset
  classify_one.ts                     # Single-action classifier smoke test
  classify_all.ts                     # Run classifier across actions; --force re-classifies all
  eval.ts                             # Re-classify golden set; record metrics in eval_runs
  inspect_classifications.ts          # Print the current is_final classifications
  dump_classifications.ts             # Export current state to a JSON snapshot
data/
  synthetic_actions.json              # 80 hand-designed agent actions
  synthetic_actions.schema.json       # JSON Schema for the dataset file
  classifications_v1_block_full.json  # Frozen snapshot, diff baseline for future runs
  sample_upload.json                  # 3-action sample shown on /upload (also in public/)
docs/
  findings_block_full.md              # Source notes for this README
migrations/
  0001_initial.sql
  0002_unique_actions.sql
```

---

Built with Claude Code. The interesting work was not what I told the assistant to do, it was where I stopped it, what I asked twice, and the failures I chose to document instead of hide.

Pedro Cabrera Fernández
