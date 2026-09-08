# USEAGE WINDOW — English copy library

Copy for English-language surfaces: GitHub, Hugging Face, awesome lists, release notes, issue replies.
This is **not** a translation of `docs/promo-zh.md` and `docs/promo-zh.md` is not a translation of this
file. The two systems have different readers and different jobs. English readers here are mostly
passers-by who found the repo from a list; they want to know what it does and what it does not do,
in that order.

House rules for every piece below:

- Say it is the author's own project. No exceptions, no matter how short the format is.
- Specific over clickbait. "Reset countdowns for Claude and Codex" beats "never run out again".
- Never claim it saves money, enforces a budget, switches models, or is approved by any store.
- Never quote a star count, download count, or user count we have not actually measured.
- No screenshots unless the caption says **illustrative mockup**, or the image is a real capture with
  account labels and balances redacted.
- Position as a companion to `dsh-cost-meter`, never as a replacement. It reads that plugin's RPCs.

---

## 1. Awesome-list one-liner (≤160 chars)

> Floating window in DeepSeek Harness Web: Claude/Codex subscription windows with reset countdowns, next to today's DeepSeek spend. Companion to dsh-cost-meter.

*158 characters.* Where a list requires the "own project" disclosure inline, use the PR body for it:

> Disclosure: I wrote this plugin. It is a display-only companion to dsh-cost-meter and
> dsh-plugin-subscriptions, not a replacement for either.

### Shorter variant, if the list caps at 120

> Floating DSH Web window for Claude/Codex subscription windows, reset countdowns, and today's DeepSeek spend.

---

## 2. GitHub repo "About" blurb (≤120 chars)

> Floating DSH Web window: Claude/Codex subscription usage windows, reset countdowns, and today's DeepSeek spend.

*111 characters.*

Suggested topics: `deepseek-harness`, `dsh-plugin`, `usage-monitor`, `claude`, `codex`, `deepseek-api`.

---

## 3. Hugging Face community post (≤180 words)

**Title:** A floating usage window for DeepSeek Harness Web (Claude + Codex + DeepSeek API)

**Body:**

> This is my own project, so treat this as a "here's the thing I made" post rather than a review.
>
> USEAGE WINDOW (`dsh-usage-mini`) is a small draggable window inside DSH Web. It shows the Claude and
> Codex subscription usage windows with their reset countdowns, and separately today's DeepSeek API
> spend and the cached account balance. Subscriptions get percentages and reset times; the API gets
> money. It never mixes the two, because a subscription does not have a dollar balance.
>
> It is display-only. It does not enforce budgets, stop agents, switch models, or promise savings.
> It has no data of its own either: it reads `dsh-cost-meter` and `dsh-plugin-subscriptions` over
> same-origin RPCs, so install those first. Think companion window, not competitor.
>
> There is a one-line feedback box at the bottom that opens a pre-filled GitHub issue. Every issue
> gets a reply, and the ones I adopt ship with the issue number in the CHANGELOG. That is genuinely
> how the last two releases got their scope.

*164 words.*

---

## 4. GitHub Release paragraph template (≤80 words)

> **USEAGE WINDOW vX.Y.Z** — <one clause on the headline change>. <One or two sentences of specifics:
> what changed, what it affects, what it does not affect.> Still display-only: no budget enforcement,
> no model switching, no savings claims. Requires `dsh-plugin-subscriptions` and/or `dsh-cost-meter`
> in the same Web profile; neither is bundled. Adopted feedback issues are credited below. Install the
> attached tarball, then restart the Web profile and refresh the page.

Filled example (0.2.0):

> **USEAGE WINDOW v0.2.0** — the widget now follows your DSH interface language. Every label switches
> between Chinese and English with the host's Language setting, with no separate toggle to remember.
> Nothing else changed: same RPCs, same local storage keys, same display-only scope — no budget
> enforcement, no model switching, no savings claims. Requires `dsh-plugin-subscriptions` and/or
> `dsh-cost-meter`; neither is bundled. Install the attached tarball, restart the Web profile, refresh.

*69 words; the blank template is also 69.*

---

## 5. X / Reddit short post (≤280 chars)

> My own project: a floating window for DeepSeek Harness Web showing Claude + Codex subscription
> windows, their reset countdowns, and today's DeepSeek API spend in one place. Display only — it
> reads dsh-cost-meter and dsh-plugin-subscriptions.
> github.com/teethyachi/dsh-usage-mini

*278 characters including the URL line.*

For subreddits that want the disclosure as a first line instead, use:

> [My own project] Floating usage window for DeepSeek Harness Web: Claude/Codex subscription windows
> + reset countdowns + today's DeepSeek spend. Display only, reads dsh-cost-meter's RPCs.

Do not post this anywhere with a self-promotion rule you have not read first, and do not post the
same text to more than one subreddit in a day.

---

## 6. Feedback-issue reply templates

Every `feedback` issue gets one of these. Reply in the language the reporter used. Keep it to two or
three sentences; the CHANGELOG carries the detail.

### 6a. Adopted

> Thanks — taking this one. <Restate the change in one concrete sentence, so we agree on what ships.>
> It'll go out in the next release and this issue number will be in the CHANGELOG entry. I'll comment
> here again when it's tagged.

### 6b. Not adopted, with reason

> Thanks for writing this up — I'm not going to build it, and I'd rather say so than leave it open.
> <The actual reason in one sentence: out of the fixed scope (Claude/Codex subscriptions and the
> DeepSeek API only), needs a network endpoint or credential the plugin deliberately doesn't have, or
> belongs upstream in dsh-cost-meter.> If <the alternative>, that part I would take — open a new issue
> and I'll pick it up.

### 6c. Need more information

> Thanks — I want to reproduce this before I touch it, and right now I can't. <One sentence naming
> exactly what's missing: browser and version, which section showed it, what the window did instead of
> what you expected, the plugin version from the widget.> Please redact account labels and balances in
> anything you paste. I'll keep this open in the meantime.

---

## 7. Words to avoid in English copy

| Don't write | Why | Write instead |
|---|---|---|
| "saves you money" | We measure nothing about spend outcomes | "shows what you've spent today" |
| "never hit your limit again" | We do not enforce anything | "shows the countdown to your next reset" |
| "replaces dsh-cost-meter" | We read its RPCs; it is a dependency | "companion to dsh-cost-meter" |
| "approved for the DSH store" | Not our call to make | "install from the repo or the tarball" |
| "trusted by N developers" | No such number exists | say nothing about adoption |
| "all your AI usage" | Three sources only | "Claude and Codex subscriptions, plus the DeepSeek API" |
