// All user-facing help, tooltip, and subtitle copy in one file. Edit here to
// iterate the pedagogy without touching components. Keep tooltips short — one
// or two lines max — and use plain language (no internal jargon).

export const SITE = {
  name: "Coherence Console",
  tagline: "Detect when AI agents drift in production.",
  footer: "Built in 8 hours with Claude Code.",
};

export const PAGES = {
  home: {
    title: "Coherence Console",
    subtitle:
      "Did the agent do the right thing? A small classifier asks that question over a sample of production actions; a human reviewer confirms or overrides; the labels become a regression-detection signal over time.",
  },
  review: {
    title: "Review",
    subtitle:
      "One action at a time. Confirm what the classifier got right; override what it didn't. Your labels become the golden set used by `npm run eval`.",
  },
  evals: {
    title: "Eval Runs",
    subtitle:
      "Each row is a `npm run eval` invocation: re-classify the golden set against the current prompt, compare to human labels, record metrics. Diffs over time = regression detection.",
  },
  stats: {
    title: "Stats",
    subtitle:
      "Where the money goes when the classifier runs over the dataset. The 'saved' number is the counterfactual: what we'd have paid if we routed everything through Sonnet instead of cascading.",
  },
  login: {
    title: "Coherence Console",
    subtitle: "Demo access",
  },
};

export const NAV_CARDS = {
  review: {
    title: "Review actions",
    description:
      "Walk through the 80-action dataset, one at a time. Confirm or override the classifier; build the golden set.",
    cta: "Open review",
  },
  evals: {
    title: "Eval runs",
    description:
      "History of `npm run eval` invocations: accuracy, precision, recall, cost, escalation rate, deltas over time.",
    cta: "Open evals",
  },
  stats: {
    title: "Cost & stats",
    description:
      "Total spend, escalation rate, per-model breakdown, and what we'd save vs always going to Sonnet.",
    cta: "Open stats",
  },
};

export const TOOLTIPS = {
  // /stats
  totalActions:
    "Synthetic agent actions hand-designed for this demo. Five categories: correct, incorrect, ambiguous, policy violation, autonomy violation.",
  totalCost:
    "Sum of cost_usd across the final classification of every dataset action. Excludes the seed test action.",
  escalationRate:
    "Percentage of actions where Haiku's verdict triggered the cascade and Sonnet was called as a second opinion. Lower means cheaper; higher means more uncertain inputs.",
  costSaved:
    "What we'd have paid if every action went straight to Sonnet, minus what we actually paid with the Haiku-first cascade. The whole point of the cascade.",
  // /evals
  evalAccuracy:
    "Percentage of human-labeled cases the classifier got right on this run. Synthetic-baseline rows show — because comparing the classifier against itself is trivially 1.000.",
  evalPrecision:
    "Macro-averaged across the three classes (correct / incorrect / needs_review). For each class: of the cases the classifier said were that class, how many actually were?",
  evalRecall:
    "Macro-averaged across the three classes. For each class: of the cases that actually were that class (per the human label), how many did the classifier catch?",
  evalDelta:
    "Difference in accuracy versus the next-newer run, so you can read how the latest prompt change moved the metric.",
  evalEscalationRate:
    "Percentage of golden-set re-classifications where Haiku triggered the cascade and Sonnet was called.",
  evalSyntheticBadge:
    "Synthetic baseline: golden_set was empty so the classifier was compared to itself. Real metrics appear after a human labels at least one action via /review and re-runs `npm run eval`.",
  // /review
  reviewProgress:
    "How many of the dataset actions you (or any human reviewer) have labeled in golden_set.",
  reviewKeyboardHint:
    "Press 1 to confirm the classifier, 2-4 to override, ←/→ to navigate without labeling.",
  classificationCorrect:
    "The agent achieved the user's intent within policy and within the agent's autonomy.",
  classificationIncorrect:
    "The agent violated policy, gave wrong information, took an unauthorized action, or failed the user's intent.",
  classificationNeedsReview:
    "The classifier could not decide cleanly — two reasonable readings give different verdicts.",
  policyViolations:
    "Short tags the classifier raised. cross_customer_data_access flags a request for someone else's data; unauthorized_action flags actions exceeding the agent's scope.",
  autonomyAppropriate:
    "Did the agent's behavior match the autonomy_level it had? False if it acted beyond OR failed to use authority granted at that level.",
  escalationRecommended:
    "The classifier's own self-report that this case warrants a second opinion. Surfaced as informational signal; the cascade trigger uses a different rule (semantic uncertainty).",
  modelHaiku:
    "Claude Haiku 4.5 — the primary classifier. Fast and cheap; handles the easy 90% of cases.",
  modelSonnet:
    "Claude Sonnet 4.6 — the escalation classifier. Slower and pricier; called only on cases where Haiku showed semantic uncertainty.",
  cascadeRule:
    "Cascade fires when ANY of: (a) confidence < 0.7, (b) classification === 'needs_review', or (c) classification === 'correct' AND policy_violations is non-empty.",
  // /review buttons
  btnConfirm:
    "Save the classifier's verdict as the human label. Use when you agree.",
  btnOverrideCorrect:
    "Save 'correct' as the human label, regardless of what the classifier said.",
  btnOverrideIncorrect:
    "Save 'incorrect' as the human label, regardless of what the classifier said.",
  btnNeedsReview:
    "Save 'needs_review' as the human label — the case is genuinely ambiguous and shouldn't be forced into correct/incorrect.",
};
