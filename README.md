# SATLens

## Contributors
Sankalp Dey and Shriyan Dey.

## Description
A tool that analyzes a student's SAT practice history to figure out exactly where and why they're losing points, rather than just giving them a score.

Core features:

- 📄 PDF upload: Upload practice tests/PDFs and have AI analyze the questions and results.

- 📊 Weakness dashboard: Break performance down by SAT domains and specific skills.

- 🔍 Mistake analysis: AI identifies patterns in the student's mistakes and explains why they're making them.

- 📝 AI error log: Automatically records mistakes, question types, dates, accuracy, and recurring errors.

- 🎯 Targeted practice: Click a weak skill and get personalized questions designed around that weakness.

- 📈 Progress tracking: Track accuracy and improvement over days/weeks.

- 🌐 Browser extension: Analyze supported online practice questions directly and add them to the student's error log.

## The main differentiator
It's not another AI SAT tutor.

The idea is:

“The SAT tells you what you got wrong. SATLens tells you why you're getting it wrong.”

AI analyzes the student's history and reasoning across multiple questions to identify recurring misconceptions and then adapts their practice accordingly.

---

## Running it

SATLens is a Next.js app with a local SQLite database. Nothing leaves your machine except the API calls to Claude.

**1. Install dependencies**

```bash
npm install
```

**2. Add your Anthropic API key**

```bash
cp .env.example .env.local
```

Then put your key in `.env.local` (get one at [console.anthropic.com](https://console.anthropic.com/settings/keys)):

```
ANTHROPIC_API_KEY=sk-ant-...
```

**3. Start the app**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database (`satlens.db`) is created on first run and is gitignored.

### Trying it with sample data

To see the dashboard, patterns, and progress tracking populated without importing anything:

```bash
node scripts/seed.mjs --reset
```

This loads a fictional student's three practice tests plus a week of targeted practice, with diagnoses and detected patterns already in place. All question text in the fixture is original. Run it again with `--reset` to start clean.

## How it works

The central loop is **Practice → Analyze → Detect Pattern → Explain → Target → Retest → Measure Growth**.

| Step | Where it lives |
|---|---|
| Import questions (manual, pasted text, or PDF) | `/import` → `src/lib/importer.ts` |
| Diagnose *why* a wrong answer was wrong | `src/lib/analysis.ts` |
| Find recurring mechanisms across the whole history | `src/lib/patterns.ts` |
| Error log with repeat-mistake detection | `/errors` → `getErrorLog()` in `src/lib/repo.ts` |
| Generate original practice targeting one pattern | `src/lib/practice.ts` |
| Evaluate the retest and update pattern status | `submitPracticeAnswer()` + `recomputePatternStatuses()` |
| Dashboard aggregates | `src/lib/stats.ts` (pure SQL, no model calls) |

Every question is classified against the real Digital SAT taxonomy (`src/lib/taxonomy.ts`) — 8 domains and 27 skills — so accuracy rolls up along a structure the College Board actually uses, and patterns can be narrower than the skill they belong to.

A pattern is only recorded when the same mechanism appears in **at least two** different questions, and every pattern cites the specific attempts that justify it. Attempt IDs returned by the model are validated against the database before storage, so a hallucinated citation is dropped rather than displayed.

### Pattern status

A pattern moves from **Active** through **Improving** to **Resolving** based on what you do on that skill *after* its most recent occurrence:

- **Improving** — at least 2 later attempts, ≥60% correct
- **Resolving** — the last 3 attempts all correct and ≥80% correct overall

This is recomputed after every import and every practice submission.

## On copyright

SATLens never stores or redistributes College Board material. Practice questions are generated originals written to target a specific diagnosed weakness. The import feature is for analyzing material you already legally have — it records your own answers and the classification, and what it stores is your practice history, not a question bank.

## Not built yet

Deliberately deferred to keep the core loop solid:

- Browser extension for analyzing online practice in place
- PDF material used as a study *reference* for explanations (the PDF path currently extracts questions only)
- Multi-user accounts — the app assumes a single local student

## Tech

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · SQLite (better-sqlite3) · Recharts · Claude (`claude-opus-5`) via the Anthropic TypeScript SDK, with all model output constrained by Zod schemas through structured outputs.
