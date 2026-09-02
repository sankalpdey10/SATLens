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

To run a demo:

**Step 1.**
```bash
npm install
```

**Step 2.**
```bash
npm run seed && npm run demo
```

**Step 3.**
copy and paste "http://localhost:3000" into your browser


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

### Demo mode (no API key needed)

SATLens runs the entire product with **zero API calls**:

```bash
npm run seed   # load Sankalp's practice history
npm run demo   # start with SATLENS_DEMO=1
```

Every feature works — diagnosis, pattern detection, practice generation, retest evaluation, the study plan, classification and text import — backed by deterministic implementations in `src/lib/demo.ts` rather than the model. The only thing it cannot do is read a PDF; that path reports that no questions were found and points at the paste-text tab.

**What this means, stated plainly for whoever maintains this repo:** in demo mode the analysis is rule-based, not model-generated. The fallbacks are data-driven — pattern detection really does group the student's diagnoses by skill and mistake type, the study plan really does weight time against measured accuracy, and retest status is computed from real attempts — so the app behaves correctly if questions are added live. But rules cannot describe a mechanism they were not given, and the product UI does not label itself as running in demo mode. If someone asks whether a particular screen is live AI, the honest answer depends on which mode it was started in.

Set `ANTHROPIC_API_KEY` in `.env.local` and run `npm run dev` instead of `npm run demo` for real model-backed analysis.

### Trying it with sample data

```bash
npm run seed
```

Loads **Sankalp**, a demo student with 140 analyzed questions across five practice tests and two recent sessions: 77% overall accuracy, a 69-second average, 32 diagnosed mistakes and three detected patterns. His profile is deliberately uneven — strong in Algebra, Advanced Math and Geometry, weak in Inference and Words in Context — so the dashboard, error log, pattern pages and study plan all have something real to show.

All passages, questions and answer choices in the fixture are original writing.

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
