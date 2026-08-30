/**
 * Offline demo mode.
 *
 * When SATLENS_DEMO=1, every model-backed feature falls back to one of these
 * deterministic implementations instead of calling Claude. This exists so the
 * product can be demonstrated end to end with no API key, no network, and no
 * latency.
 *
 * These are RULES, not reasoning. They are written to be data-driven -- they
 * read the student's real attempts, diagnoses and stats, so the demo still
 * responds correctly if someone adds a question live -- but they cannot do
 * what the model does, and nothing here should be presented as AI analysis.
 */

import { ALL_SKILLS, MISTAKE_LABELS, domainForSkill, findSkill } from "./taxonomy";
import type { MistakeType } from "./taxonomy";

/* ------------------------------------------------------------------ helpers */

function pick<T>(items: T[], seed: string): T {
  // Deterministic choice so the same input always demos the same way.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(hash) % items.length];
}

function choiceText(
  choices: { label: string; text: string }[],
  label: string,
): string | null {
  return (
    choices.find((c) => c.label.toLowerCase() === label.trim().toLowerCase())
      ?.text ?? null
  );
}

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;
}

/* --------------------------------------------------------------- diagnosis */

export interface DemoAttemptInput {
  section: string;
  domain: string;
  skill: string;
  question_text: string;
  choices: { label: string; text: string }[];
  student_answer: string;
  correct_answer: string;
  student_reasoning: string | null;
  id: string;
}

/** Heuristic mistake classification from the skill and the student's own words. */
function inferMistakeType(a: DemoAttemptInput): MistakeType {
  const reasoning = (a.student_reasoning ?? "").toLowerCase();
  const isMath = a.section === "Math";

  if (/squar|root|radical|extraneous/.test(reasoning))
    return "conceptual_misunderstanding";
  if (/sign|negative|minus|added|combin|arithmetic|multipl/.test(reasoning))
    return "calculation_error";
  if (/stated|definitely|true|says|mentioned|directly/.test(reasoning))
    return "distractor_selection";
  if (/skimmed|missed|didn't see|did not see|misread|overlook/.test(reasoning))
    return "misreading";
  if (/eliminat|guess|between|narrowed/.test(reasoning)) return "strategy_issue";
  if (/thought .* meant|assumed|interpreted/.test(reasoning))
    return "incorrect_interpretation";
  if (/formula|rule|remember|forgot/.test(reasoning)) return "knowledge_gap";

  return isMath ? "calculation_error" : "distractor_selection";
}

const CONCEPTS: Partial<Record<string, string>> = {
  "Central Ideas and Details":
    "A choice can be completely true and still be wrong. Main idea asks which claim the other sentences exist to support, not which statement appears in the text.",
  "Command of Evidence (Textual)":
    "Evidence must support the claim being made, not merely relate to the topic. For an 'X rather than Y' claim, prefer the quotation that establishes X directly.",
  Inferences:
    "The answer must follow from the text alone. Plausible real-world knowledge is not the same as textual support.",
  "Words in Context":
    "Substitute each choice back into the sentence. The right word fits both the meaning and the register of the surrounding prose.",
  Transitions:
    "Read the sentence after the blank before choosing. The transition encodes a relationship, and only the second sentence tells you its direction.",
  Boundaries:
    "Decide first whether each side of the punctuation is an independent clause. That single test resolves most boundary questions.",
  "Nonlinear Equations and Systems":
    "Squaring is not reversible. Every solution to a radical equation must be checked against the original before it counts.",
  "Equivalent Expressions":
    "After cancelling, rewrite the surviving numerator and denominator explicitly rather than tracking them mentally.",
  "Linear Functions":
    "In a linear model, the slope is the per-unit rate of change and the intercept is the starting value. Name both in context before answering.",
  Percentages:
    "Successive percent changes multiply, they do not add. Convert each step to a multiplier first.",
};

const FASTER: Partial<Record<string, string>> = {
  "Central Ideas and Details":
    "Find the pivot word ('Yet', 'But', 'However'). On main-idea questions the thesis almost always sits immediately after it.",
  "Nonlinear Equations and Systems":
    "With four numeric choices, substituting them into the original equation is faster than squaring and cannot produce an extraneous root.",
  Percentages:
    "Chain the multipliers in one step (0.70 × 0.80 = 0.56) instead of computing each intermediate price.",
  Transitions:
    "Decide 'same direction or opposite' in your own words before reading the choices. Half the options usually die immediately.",
  "Linear Functions":
    "Slope from two points is pure subtraction and division -- no need to build the full equation unless the question asks for it.",
};

export function demoDiagnosis(a: DemoAttemptInput) {
  const mistakeType = inferMistakeType(a);
  const chosen = choiceText(a.choices, a.student_answer);
  const correct = choiceText(a.choices, a.correct_answer);

  const chosenPhrase = chosen
    ? `Choice ${a.student_answer} ("${truncate(chosen, 90)}")`
    : `Choice ${a.student_answer}`;
  const correctPhrase = correct
    ? `Choice ${a.correct_answer} ("${truncate(correct, 90)}")`
    : `Choice ${a.correct_answer}`;

  const headlines: Record<MistakeType, string> = {
    distractor_selection: "Selected a tempting distractor over the defensible answer.",
    conceptual_misunderstanding: "The underlying rule for this question type was misapplied.",
    calculation_error: "Right method, wrong arithmetic at the final step.",
    misreading: "Part of the question or text was read inaccurately.",
    incorrect_interpretation: "Correct work mapped to the wrong answer.",
    strategy_issue: "A workable but error-prone approach was used here.",
    knowledge_gap: "A required rule or formula was not available.",
    missed_faster_solution: "Answered correctly in spirit, but by the slowest available route.",
  };

  const explanation =
    `${chosenPhrase} was selected where ${correctPhrase} was correct. ` +
    (a.student_reasoning
      ? `Your own note -- "${truncate(a.student_reasoning, 120)}" -- points at the mechanism: this reads as ${MISTAKE_LABELS[mistakeType].toLowerCase()}. `
      : `Based on the answer pattern this reads as ${MISTAKE_LABELS[mistakeType].toLowerCase()}. `) +
    `The distinguishing move on ${a.skill} questions is the one described below.`;

  return {
    mistake_type: mistakeType,
    headline: headlines[mistakeType],
    explanation,
    concept:
      CONCEPTS[a.skill] ??
      `On ${a.skill} questions, re-read what the question is actually asking for before committing to a choice.`,
    faster_solution: FASTER[a.skill] ?? null,
    trap: chosen
      ? `Choice ${a.student_answer} is engineered to look right to a student who stops one step early.`
      : null,
    confidence: 0.55,
  };
}

/* ---------------------------------------------------------------- patterns */

export interface DemoPatternRow {
  id: string;
  skill: string;
  domain: string;
  section: string;
  mistake_type: string;
  headline: string;
  occurred_on: string;
}

/**
 * Groups diagnosed mistakes by (skill, mistake type) and promotes any group
 * with 2+ members to a pattern. This is genuinely the shape the real detector
 * looks for -- it just cannot describe the mechanism in its own words.
 */
/**
 * Hand-written copy for the mechanism combinations that show up most often, so
 * demo-mode detection produces something worth reading rather than a template.
 * Keyed by `skill::mistake_type`; anything unmatched falls back to the template.
 */
const PATTERN_COPY: Record<string, { title: string; description: string; recommendation: string }> = {
  "Inferences::incorrect_interpretation": {
    title: "Draws inferences that go beyond what the passage supports",
    description:
      "On inference questions the answer keeps being completed with outside knowledge rather than with the passage's own evidence. Most misses select a conclusion that is plausible but needs an assumption the text never supplies; the rest select a detail that is accurate but does not support the conclusion being drawn. The problem is not that inference is unclear -- it is stopping past where the evidence stops.",
    recommendation:
      "For every choice, ask what would ALSO have to be true for it to work. If that extra fact is not in the passage, eliminate the choice however reasonable it sounds. Correct inference answers should feel almost too cautious.",
  },
  "Words in Context::distractor_selection": {
    title: "Selects the familiar definition instead of the contextual meaning",
    description:
      "The word's most common everyday sense is winning over the sense the sentence actually needs. In most of these the sentence contains a clue clause that settles the question on its own, but the first definition recalled is the one being checked first.",
    recommendation:
      "Cover the answer choices. Read the sentence and say your own replacement word aloud, then pick the choice closest to it.",
  },
  "Ratios, Rates, and Units::conceptual_misunderstanding": {
    title: "Sets up the relationship incorrectly on ratio and rate problems",
    description:
      "These misses are setup errors, not arithmetic errors. The relationship gets inverted before any computation happens, and the calculation is then performed correctly on a relationship that was already wrong.",
    recommendation:
      "Write the relationship with units attached before substituting numbers, and sanity-check the direction: should the answer be larger or smaller than the number you were given?",
  },
  "Central Ideas and Details::distractor_selection": {
    title: "Chooses detail-supported answers over the passage's central claim",
    description:
      "On main-idea questions the choice that is easiest to verify against the text keeps winning over the one the text is built to argue. The failure is testing choices for factual presence rather than for argumentative role -- a choice can be entirely true and still be a supporting detail. It fires hardest when the passage opens with a vivid concrete detail and places its thesis after a pivot.",
    recommendation:
      "Find the pivot word ('Yet', 'But', 'However') and restate the sentence after it in your own words before looking at the choices. Then reject anything that is merely true: ask 'is this what the other sentences exist to support?' rather than 'is this stated?'",
  },
  "Nonlinear Equations and Systems::conceptual_misunderstanding": {
    title: "Skips the extraneous-root check on radical equations",
    description:
      "Radical equations are being solved by squaring and factoring correctly, and then stopped one step early -- no substitution back, no domain constraint. Squaring is not reversible, so it can introduce roots the original equation never had, and the answer sheet reliably offers 'both roots' as a choice.",
    recommendation:
      "Write the constraint before you square: for √A = B, note 'B ≥ 0' at the top of your work, then cross out any root that violates it. With four numeric choices, testing them directly is often faster than squaring at all.",
  },
  "Equivalent Expressions::calculation_error": {
    title: "Sign and bookkeeping slips in the final step of manipulation",
    description:
      "The method on expression questions is sound and the last step is reached correctly, then a sign is lost or the surviving factor is inverted. The mirror-image wrong answer is almost always available as a choice, so the slip lands on something that looks plausible.",
    recommendation:
      "Slow down for the final line specifically. Write combinations out explicitly (-6 + 5 = -1) instead of doing them mentally, and after cancelling, rewrite the surviving numerator and denominator on a fresh line.",
  },
  "Command of Evidence (Textual)::strategy_issue": {
    title: "Supports 'X rather than Y' claims by ruling out Y",
    description:
      "On evidence questions with a comparative claim, the quotation that undercuts the alternative explanation is being chosen over the one that positively establishes the mechanism. Eliminating the rival leaves the claim itself unsupported.",
    recommendation:
      "Split the claim into its two halves and check which half each quotation actually speaks to. Prefer the choice that supplies the mechanism and its timing over the one that merely removes a competitor.",
  },
  "Transitions::incorrect_interpretation": {
    title: "Reads contrasts as consequences",
    description:
      "Transitions are being chosen from the tone of the first sentence alone, without checking the direction of the second. A sentence listing advantages followed by one naming a blocking drawback is opposition, not result.",
    recommendation:
      "Read the sentence after the blank first. Decide 'same direction or opposite' in your own words before looking at the choices -- that eliminates half of them immediately.",
  },
};

export function demoPatterns(rows: DemoPatternRow[]) {
  const groups = new Map<string, DemoPatternRow[]>();
  for (const row of rows) {
    const key = `${row.skill}::${row.mistake_type}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const patterns = [...groups.values()]
    .filter((group) => group.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 6)
    .map((group) => {
      const first = group[0];
      const label = MISTAKE_LABELS[first.mistake_type as MistakeType] ?? first.mistake_type;
      const written = PATTERN_COPY[`${first.skill}::${first.mistake_type}`];

      const span = `Seen across ${group.length} questions from ${group[0].occurred_on} through ${group[group.length - 1].occurred_on}.`;

      return {
        title: written?.title ?? `Repeated ${label.toLowerCase()} on ${first.skill}`,
        description: written
          ? `${written.description} ${span}`
          : `Across ${group.length} questions on ${first.skill}, the same failure mode recurs: ${label.toLowerCase()}. ` +
            `The individual diagnoses read: ${group
              .slice(0, 3)
              .map((g) => `"${truncate(g.headline, 70)}"`)
              .join("; ")}. ${span}`,
        recommendation:
          written?.recommendation ??
          CONCEPTS[first.skill] ??
          `Before answering a ${first.skill} question, state in your own words what the question is asking for, then check your choice against that sentence.`,
        section: first.section as "Reading and Writing" | "Math",
        domain: first.domain,
        skill: first.skill,
        mistake_type: first.mistake_type as MistakeType,
        severity: (group.length >= 4
          ? "high"
          : group.length >= 3
            ? "moderate"
            : "low") as "low" | "moderate" | "high",
        // More corroborating questions means more confidence the pattern is real.
        confidence: Math.min(0.45 + group.length * 0.12, 0.95),
        evidence: group.map((g) => ({
          attempt_id: g.id,
          note: `Diagnosed as ${label.toLowerCase()}: ${truncate(g.headline, 80)}`,
        })),
      };
    });

  return { patterns };
}

/* ---------------------------------------------------------------- practice */

interface BankItem {
  passage: string | null;
  question_text: string;
  choices: { label: "A" | "B" | "C" | "D"; text: string }[];
  correct_answer: "A" | "B" | "C" | "D";
  rationales: { label: "A" | "B" | "C" | "D"; why: string }[];
  teaching_point: string;
  faster_approach: string | null;
}

/** Original questions written for this fixture. No College Board material. */
const BANK: Record<string, BankItem[]> = {
  Inferences: [
    {
      passage:
        "Coastal towns that installed artificial reefs reported fewer storm-damage claims than neighbouring towns without them. Insurers initially credited the reefs with absorbing wave energy. But the towns that installed reefs were also the towns that had recently updated their building codes, and claims fell in the years immediately following the code change rather than after the reefs matured. This suggests that the reduction in claims ______",
      question_text: "Which choice most logically completes the text?",
      choices: [
        { label: "A", text: "proves that artificial reefs provide no protection against storms." },
        { label: "B", text: "cannot be attributed to the reefs on the evidence available." },
        { label: "C", text: "would have been larger if the reefs had been installed sooner." },
        { label: "D", text: "shows that building codes are the only factor affecting storm damage." },
      ],
      correct_answer: "B",
      rationales: [
        { label: "A", why: "Goes further than the evidence. Showing that a cause has not been isolated is not the same as showing it has no effect — the passage never rules the reefs out." },
        { label: "B", why: "Correct. Two changes happened together and the timing points at the codes, so the reef explanation is not established. This is exactly as far as the evidence reaches." },
        { label: "C", why: "Requires an assumption the passage never supplies — that earlier installation would have changed the outcome. Nothing in the text speaks to that." },
        { label: "D", why: "'The only factor' is far stronger than anything stated. The passage identifies a confound, it does not rank causes." },
      ],
      teaching_point:
        "When two variables change together, the honest inference is that the effect cannot be assigned to either one. Choices that pick a winner — in either direction — require an assumption the passage has not given you.",
      faster_approach:
        "Scan for absolute words: 'proves', 'no', 'only', 'would have been'. Each one is a claim the passage has to license, and usually it has not.",
    },
  ],
  "Words in Context": [
    {
      passage:
        "The engineer was reluctant to advance the prototype for review, noting that two subsystems had not yet been tested under load.",
      question_text: "As used in the text, what does the word \"advance\" most nearly mean?",
      choices: [
        { label: "A", text: "Move forward in time" },
        { label: "B", text: "Lend money against future earnings" },
        { label: "C", text: "Submit for consideration" },
        { label: "D", text: "Improve in quality" },
      ],
      correct_answer: "C",
      rationales: [
        { label: "A", why: "The common scheduling sense. Nothing here is being rescheduled — the object of 'advance' is a prototype, not a date." },
        { label: "B", why: "A real sense of the word, but there is no money or payment anywhere in the sentence." },
        { label: "C", why: "Correct. The prototype is being put forward 'for review', so advancing it means submitting it for consideration." },
        { label: "D", why: "Confuses the word with 'advanced'. The engineer is not improving the prototype; they are hesitating to hand it over." },
      ],
      teaching_point:
        "Let the sentence's own words define the term. 'For review' tells you what advancing does here, and it rules out every other sense before you weigh them.",
      faster_approach:
        "Cover the choices and say your own replacement word first. If your word is 'submit', C is immediate.",
    },
  ],
  "Ratios, Rates, and Units": [
    {
      passage: null,
      question_text:
        "A printer produces 7 pages every 4 seconds. At this rate, how many seconds are needed to print 91 pages?",
      choices: [
        { label: "A", text: "52" },
        { label: "B", text: "159" },
        { label: "C", text: "364" },
        { label: "D", text: "637" },
      ],
      correct_answer: "A",
      rationales: [
        { label: "A", why: "Correct. 91 ÷ 7 = 13 groups, and each takes 4 seconds, so 13 × 4 = 52 seconds." },
        { label: "B", why: "Comes from adding rather than scaling the relationship." },
        { label: "C", why: "This is 91 × 4, which scales pages by seconds-per-page without first dividing into groups." },
        { label: "D", why: "This is 91 × 7, multiplying by pages-per-group — the ratio applied upside down." },
      ],
      teaching_point:
        "Attach units before you compute. You want seconds, so the factor you multiply by must carry seconds on top; if the units do not cancel to seconds, the setup is wrong regardless of the arithmetic.",
      faster_approach:
        "The printer is faster than one page per second, so the answer must be well under 91. That alone eliminates B, C and D.",
    },
  ],
  "Central Ideas and Details": [
    {
      passage:
        "The city of Halvard spent four years digitizing its municipal photograph archive, and the resulting database is frequently described as the most complete of its kind in the region. The archivists who built it are unpersuaded by that framing. Because they tagged every image with the street intersection where it was taken, the archive can be queried spatially — which is how researchers were able to reconstruct the pace at which the tram network was dismantled.",
      question_text: "Which choice best states the main idea of the text?",
      choices: [
        { label: "A", text: "Halvard's photograph archive is the most complete of its kind in the region." },
        { label: "B", text: "The archive's value lies in its spatial tagging, which made new research possible." },
        { label: "C", text: "Digitizing the municipal photograph archive took four years to complete." },
        { label: "D", text: "Halvard's tram network was dismantled over a period of several years." },
      ],
      correct_answer: "B",
      rationales: [
        { label: "A", why: "True, and stated — but the archivists are explicitly 'unpersuaded by that framing.' The text raises the completeness claim in order to set it aside." },
        { label: "B", why: "Correct. The final sentence explains what the tagging enabled, and every other sentence exists to build toward it." },
        { label: "C", why: "A supporting detail from the first sentence. It tells you the scale of the effort, not the point of the passage." },
        { label: "D", why: "A consequence mentioned only as an example of what the archive enabled. It is evidence for the claim, not the claim." },
      ],
      teaching_point:
        "When a passage names a common description and then says the people involved reject it, the thesis is what they offer instead — and it usually closes the paragraph.",
      faster_approach:
        "Find the sentence that dismisses something ('are unpersuaded', 'is beside the point'). The real claim follows immediately after.",
    },
  ],
  "Nonlinear Equations and Systems": [
    {
      passage: null,
      question_text: "If √(4x + 21) = x, what is the value of x?",
      choices: [
        { label: "A", text: "-3" },
        { label: "B", text: "7" },
        { label: "C", text: "-3 and 7" },
        { label: "D", text: "No solution" },
      ],
      correct_answer: "B",
      rationales: [
        { label: "A", why: "-3 is an algebraic root of the squared equation, but a square root is never negative, so √9 = 3 ≠ -3. It is extraneous." },
        { label: "B", why: "Correct. Squaring gives x² - 4x - 21 = 0, so x = 7 or x = -3. Only x = 7 satisfies the original: √49 = 7. ✓" },
        { label: "C", why: "This is the trap. Both values solve the SQUARED equation, but squaring can introduce solutions the original never had." },
        { label: "D", why: "There is a valid solution — x = 7 checks out exactly." },
      ],
      teaching_point:
        "Squaring both sides is not reversible. Every root must be substituted back into the original equation before it counts.",
      faster_approach:
        "Note that x must be ≥ 0 before you factor anything, since the left side is a square root. That eliminates A and C instantly.",
    },
  ],
  "Equivalent Expressions": [
    {
      passage: null,
      question_text: "Which expression is equivalent to (5x² - 45) / (x² - 6x + 9) for x ≠ 3?",
      choices: [
        { label: "A", text: "5(x + 3)/(x - 3)" },
        { label: "B", text: "5(x - 3)/(x + 3)" },
        { label: "C", text: "5(x + 3)/(x + 3)" },
        { label: "D", text: "5" },
      ],
      correct_answer: "A",
      rationales: [
        { label: "A", why: "Correct. 5x² - 45 = 5(x-3)(x+3) and x² - 6x + 9 = (x-3)². Cancelling one (x-3) leaves 5(x+3)/(x-3)." },
        { label: "B", why: "The surviving factors are inverted. This is what you get if you lose track of which (x-3) cancelled." },
        { label: "C", why: "This would require the denominator to factor as (x+3)², which it does not — the middle term is -6x, not +6x." },
        { label: "D", why: "This assumes both binomials cancel completely, which would require identical factors in numerator and denominator." },
      ],
      teaching_point:
        "After cancelling, write out the surviving numerator and denominator on a fresh line instead of tracking them mentally.",
      faster_approach:
        "Test x = 0 in the original: -45/9 = -5. Only choice A gives -5 at x = 0.",
    },
  ],
  Transitions: [
    {
      passage:
        "The new filtration membrane removes 99.7% of microplastics and can be manufactured from recycled feedstock. ______ its throughput is low enough that municipal-scale deployment remains impractical.",
      question_text: "Which choice completes the text with the most logical transition?",
      choices: [
        { label: "A", text: "Accordingly," },
        { label: "B", text: "Likewise," },
        { label: "C", text: "However," },
        { label: "D", text: "For instance," },
      ],
      correct_answer: "C",
      rationales: [
        { label: "A", why: "Signals a consequence. Low throughput is not a result of high filtration efficiency — it works against it." },
        { label: "B", why: "Signals addition of a similar idea, but the second sentence contradicts the optimism of the first." },
        { label: "C", why: "Correct. The first sentence lists advantages; the second names a drawback that blocks deployment. That is opposition." },
        { label: "D", why: "Signals an example, but low throughput is not an instance of removing microplastics or using recycled feedstock." },
      ],
      teaching_point:
        "Read the sentence after the blank before choosing. Only the second sentence tells you the direction of the relationship.",
      faster_approach:
        "Cover the choices and decide 'same direction or opposite' in your own words first. That eliminates half the options immediately.",
    },
  ],
  Percentages: [
    {
      passage: null,
      question_text:
        "A laptop is marked down 40%, and a member discount then takes an additional 15% off the sale price. The final price is what percent of the original price?",
      choices: [
        { label: "A", text: "45%" },
        { label: "B", text: "51%" },
        { label: "C", text: "55%" },
        { label: "D", text: "60%" },
      ],
      correct_answer: "B",
      rationales: [
        { label: "A", why: "This adds the discounts (40 + 15 = 55) and subtracts from 100. Successive percentages multiply, they do not add." },
        { label: "B", why: "Correct. 0.60 × 0.85 = 0.51, so the final price is 51% of the original." },
        { label: "C", why: "This is 100 - 45, using the incorrect additive approach in a different order." },
        { label: "D", why: "This applies only the first discount and ignores the member discount entirely." },
      ],
      teaching_point:
        "Successive percent changes multiply. Convert each step to a multiplier (40% off → ×0.60) and chain them.",
      faster_approach:
        "Chain the multipliers in one step: 0.6 × 0.85 = 0.51. No intermediate price needed.",
    },
  ],
};

export function demoPracticeItem(skill: string, difficulty: string) {
  const bank = BANK[skill];
  if (bank?.length) return pick(bank, `${skill}:${difficulty}`);

  // Generic fallback so every skill in the taxonomy is demoable.
  const node = findSkill(skill);
  const blurb = node?.blurb ?? "apply the relevant rule";
  return {
    passage: null,
    question_text: `No ${difficulty}-difficulty question is available for "${skill}" right now. This skill asks you to ${blurb.toLowerCase()} Pick any option to continue.`,
    choices: [
      { label: "A" as const, text: "Continue to the evaluation step" },
      { label: "B" as const, text: "Continue to the evaluation step" },
      { label: "C" as const, text: "Continue to the evaluation step" },
      { label: "D" as const, text: "Continue to the evaluation step" },
    ],
    correct_answer: "A" as const,
    rationales: (["A", "B", "C", "D"] as const).map((label) => ({
      label,
      why:
        label === "A"
          ? "Counted as correct for this item."
          : "Counted as incorrect for this item.",
    })),
    teaching_point: `${skill}: ${blurb}`,
    faster_approach: null,
  };
}

/* -------------------------------------------------------------- evaluation */

export function demoEvaluation(params: {
  isCorrect: boolean;
  reasoning: string | null;
  skill: string;
  patternTitle: string | null;
}) {
  const { isCorrect, reasoning, skill, patternTitle } = params;
  const explained = (reasoning ?? "").trim().length >= 25;

  const verdict = isCorrect
    ? explained
      ? ("overcame" as const)
      : ("partial" as const)
    : ("repeated" as const);

  const INSIGHT: Record<string, string> = {
    Inferences:
      "You selected an inference directly supported by the passage rather than an answer requiring an additional assumption -- the exact distinction you had been missing.",
    "Words in Context":
      "You chose the meaning the sentence needed rather than the word's most familiar sense, which is the move that had been going wrong.",
    "Ratios, Rates, and Units":
      "You set the relationship up in the right direction before computing, which is where these questions had been breaking down.",
  };

  const feedback = isCorrect
    ? explained
      ? `Correct. ${INSIGHT[skill] ?? "Your reasoning shows why rather than just landing on the answer."} That is what distinguishes a fixed habit from a lucky guess${patternTitle ? `, and it is what this question was built to retest` : ""}.`
      : `Correct — but you did not record your reasoning, so this cannot yet be distinguished from a good guess. Write out your thinking on the next one and the verdict can be stronger.`
    : `Not correct this time.${patternTitle ? ` This question was written to create an opportunity for "${patternTitle}", and the answer suggests that habit is still firing.` : ""} Re-read the concept below before the next attempt.`;

  return {
    verdict,
    feedback,
    reasoning_assessment: reasoning?.trim()
      ? explained
        ? "Your explanation identifies a specific mechanism rather than restating the answer, which is the right level of detail."
        : "Your explanation is quite short. Naming the step that decided it makes the evaluation far more useful."
      : null,
    next_step: isCorrect
      ? `Try one more ${skill} question to confirm this holds, then move to your next weakest skill.`
      : `Review the concept above, then generate another ${skill} question and talk through your reasoning before selecting.`,
  };
}

/* ---------------------------------------------------------------- classify */

const KEYWORDS: Record<string, string[]> = {
  "Central Ideas and Details": ["main idea", "central idea", "best states", "primary purpose of the text"],
  "Command of Evidence (Textual)": ["quotation", "most directly supports", "supports the claim", "finding"],
  "Command of Evidence (Quantitative)": ["graph", "table", "data", "chart", "according to the figure"],
  Inferences: ["most logically completes", "infer", "conclusion", "suggests that"],
  "Words in Context": ["most nearly means", "as used in the text", "word", "meaning of"],
  "Text Structure and Purpose": ["structure", "function of", "purpose of the underlined", "overall structure"],
  "Cross-Text Connections": ["both texts", "text 1", "text 2", "author of text"],
  Boundaries: ["conventions of standard english", "punctuation", "comma", "semicolon", "colon"],
  "Form, Structure, and Sense": ["subject-verb", "verb form", "pronoun", "modifier", "agreement"],
  "Rhetorical Synthesis": ["notes", "student wants to", "rhetorical goal", "emphasize"],
  Transitions: ["transition", "logical transition"],
  "Linear Equations in One Variable": ["solve for x", "linear equation"],
  "Linear Functions": ["slope", "rate of change", "linear model", "f(x) =", "per hour", "flat fee"],
  "Linear Equations in Two Variables": ["passes through", "y =", "line in the xy-plane"],
  "Systems of Two Linear Equations": ["system of equations", "both equations"],
  "Linear Inequalities": ["inequality", "≤", "≥", "at least", "at most"],
  "Equivalent Expressions": ["equivalent to", "simplify", "factor", "expression"],
  "Nonlinear Equations and Systems": ["√", "square root", "quadratic", "x²", "radical"],
  "Nonlinear Functions": ["parabola", "vertex", "exponential", "growth factor"],
  "Ratios, Rates, and Units": ["ratio", "rate", "per", "unit", "proportion"],
  Percentages: ["percent", "%", "discount", "markup", "increase"],
  "One-Variable Data and Distributions": ["mean", "median", "standard deviation", "spread"],
  "Two-Variable Data and Models": ["scatterplot", "line of best fit", "correlation"],
  "Probability and Conditional Probability": ["probability", "chance", "randomly selected"],
  "Inference from Samples and Margin of Error": ["margin of error", "sample", "confidence interval"],
  "Evaluating Statistical Claims": ["study", "experiment", "generalize", "causal"],
  "Area and Volume": ["area", "volume", "surface area", "cylinder", "cube"],
  "Lines, Angles, and Triangles": ["angle", "triangle", "parallel", "similar", "congruent"],
  "Right Triangles and Trigonometry": ["sin", "cos", "tan", "hypotenuse", "pythagorean"],
  Circles: ["circle", "radius", "arc", "sector", "circumference"],
};

export function demoClassify(input: {
  question_text: string;
  passage?: string | null;
  choices?: { label: string; text: string }[];
}) {
  const haystack = [
    input.question_text,
    input.passage ?? "",
    ...(input.choices ?? []).map((c) => c.text),
  ]
    .join(" ")
    .toLowerCase();

  let best = ALL_SKILLS[0].name;
  let bestScore = 0;
  for (const [skill, words] of Object.entries(KEYWORDS)) {
    const score = words.reduce(
      (n, w) => n + (haystack.includes(w.toLowerCase()) ? w.length : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = skill;
    }
  }

  const node = domainForSkill(best);
  return {
    section: (node?.section ?? "Reading and Writing") as "Reading and Writing" | "Math",
    domain: node?.name ?? "Information and Ideas",
    skill: best,
    difficulty: "medium" as const,
    confidence: bestScore > 0 ? Math.min(0.4 + bestScore / 60, 0.75) : 0.25,
    reason:
      bestScore > 0
        ? `The phrasing and answer choices match what ${best} questions ask you to do.`
        : `No strong signal either way, so this defaulted to ${best} -- check it before saving.`,
  };
}

/* ------------------------------------------------------------- extraction */

/**
 * Parses the simple format the import placeholder demonstrates:
 *   Q12 (Reading): <question>
 *     I answered B, correct was C.
 * Anything it cannot parse is reported honestly in `notes`.
 */
export function demoExtractText(text: string) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];
  let unparsed = 0;

  for (const block of blocks) {
    const answered = block.match(/answered?\s+([A-D0-9]+)/i);
    const correct = block.match(/correct\s+(?:was|is|answer)?\s*:?\s*([A-D0-9]+)/i);
    const firstLine = block.split("\n")[0].replace(/^Q?\d+\s*[.:)]?\s*/i, "").trim();

    if (!firstLine) {
      unparsed += 1;
      continue;
    }

    const classified = demoClassify({ question_text: block });
    const choices = [...block.matchAll(/^\s*([A-D])[).]\s*(.+)$/gim)].map((m) => ({
      label: m[1].toUpperCase(),
      text: m[2].trim(),
    }));

    questions.push({
      question_number: (block.match(/^Q?(\d+)/i)?.[1] ?? null) as string | null,
      section: classified.section,
      domain: classified.domain,
      skill: classified.skill,
      difficulty: null,
      passage: null,
      question_text: firstLine.replace(/\s*\([^)]*\)\s*:?/, " ").trim() || firstLine,
      choices,
      student_answer: answered?.[1]?.toUpperCase() ?? null,
      correct_answer: correct?.[1]?.toUpperCase() ?? null,
      student_reasoning: null,
      classification_confidence: classified.confidence,
    });
  }

  return {
    questions,
    notes:
      `Found ${questions.length} question${questions.length === 1 ? "" : "s"}` +
      (unparsed ? `, and could not read ${unparsed} block(s)` : "") +
      `. Review the skill on each row before saving.`,
  };
}

/* -------------------------------------------------------------------- plan */

export interface DemoPlanInput {
  weakest: { skill: string; domain: string; accuracy: number; total: number }[];
  patterns: { title: string; skill: string | null; status: string; severity: string }[];
  hoursPerWeek: number | null;
  daysUntilTest: number | null;
  targetScore: number | null;
  currentScore: number | null;
}

export function demoPlan(input: DemoPlanInput) {
  const { weakest, patterns, hoursPerWeek, daysUntilTest, targetScore, currentScore } = input;
  const hours = hoursPerWeek ?? 6;

  // Do not allocate study time to skills that are already strong. Keep at
  // least one entry so the plan is never empty.
  const struggling = weakest.filter((s) => s.accuracy < 0.85);
  const focus = (struggling.length ? struggling : weakest.slice(0, 1)).slice(0, 5);
  // Weight inversely by accuracy so the weakest skill gets the largest share.
  const weights = focus.map((s) => Math.max(1 - s.accuracy, 0.1));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const allocations = focus.map((s, i) => ({
    skill: s.skill,
    domain: s.domain,
    share_of_time: Math.round((weights[i] / totalWeight) * 100),
    rationale: `${Math.round(s.accuracy * 100)}% accuracy across ${s.total} questions${
      patterns.some((p) => p.skill === s.skill && p.status === "active")
        ? ", and it carries an active mistake pattern"
        : ""
    }.`,
  }));

  const perSession = Math.max(Math.round((hours * 60) / 4), 20);
  const sessions = focus.slice(0, 4).map((s, i) => ({
    label: `Session ${i + 1}`,
    focus: s.skill,
    minutes: perSession,
    activity:
      `Open ${s.skill} in SATLens, re-read the diagnoses on your missed questions, then run targeted practice until you get two in a row right with written reasoning.`,
    success_check: `Two consecutive correct answers on ${s.skill} with your reasoning recorded.`,
  }));

  const active = patterns.filter((p) => p.status === "active");

  return {
    summary:
      `This plan weights your study time against where you are actually losing points. ` +
      `Your weakest area is ${focus[0]?.skill ?? "not yet determined"}${
        focus[0] ? ` at ${Math.round(focus[0].accuracy * 100)}%` : ""
      }, and you have ${active.length} active mistake pattern${active.length === 1 ? "" : "s"} to clear. ` +
      (daysUntilTest !== null ? `That leaves roughly ${Math.max(Math.round(daysUntilTest / 7), 0)} weeks at ${hours}h/week. ` : "") +
      (targetScore && currentScore ? `You are ${targetScore - currentScore} points from your target.` : ""),
    adjustment_note:
      patterns.some((p) => p.status !== "active")
        ? `${patterns.filter((p) => p.status !== "active").length} pattern(s) are improving or resolving, so their skills receive less time than they would have last week.`
        : null,
    allocations,
    sessions,
    milestones: [
      { when: "End of this week", target: `Clear one active pattern by passing three consecutive retests.` },
      { when: "In two weeks", target: `Raise ${focus[0]?.skill ?? "your weakest skill"} above 70% accuracy.` },
      ...(daysUntilTest !== null && daysUntilTest > 14
        ? [{ when: `${Math.max(daysUntilTest - 7, 0)} days from now`, target: "Sit a full timed practice test and re-import it." }]
        : []),
    ],
  };
}

/* -------------------------------------------------------- faster solutions */

export function demoFasterSolutions(
  attempts: { id: string; skill: string; faster_solution: string | null }[],
) {
  const bySkill = new Map<string, { ids: string[]; tip: string | null }>();
  for (const a of attempts) {
    const entry = bySkill.get(a.skill) ?? { ids: [], tip: null };
    entry.ids.push(a.id);
    if (!entry.tip && a.faster_solution) entry.tip = a.faster_solution;
    bySkill.set(a.skill, entry);
  }

  const insights = [...bySkill.entries()]
    .filter(([, v]) => v.ids.length >= 2)
    .slice(0, 4)
    .map(([skill, v]) => ({
      title: `Faster route on ${skill}`,
      description:
        v.tip ??
        FASTER[skill] ??
        `Across ${v.ids.length} missed ${skill} questions, your approach was sound but slower than it needed to be. Look for the step you repeat that the answer choices could have given you.`,
      applies_to_skill: skill,
      example_attempt_ids: v.ids.slice(0, 4),
    }));

  return { insights };
}
