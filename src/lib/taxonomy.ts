/**
 * The Digital SAT content taxonomy (College Board's published domain/skill
 * structure). This is factual structure only -- no question content.
 *
 * Everything in SATLens classifies against this tree: imported questions get a
 * (section, domain, skill) triple, the dashboard rolls accuracy up along it, and
 * generated practice targets a single leaf skill.
 */

export const SECTIONS = ["Reading and Writing", "Math"] as const;
export type Section = (typeof SECTIONS)[number];

export interface SkillNode {
  name: string;
  slug: string;
  /** Short student-facing description of what the skill actually asks for. */
  blurb: string;
}

export interface DomainNode {
  name: string;
  slug: string;
  section: Section;
  skills: SkillNode[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function domain(
  section: Section,
  name: string,
  skills: [string, string][],
): DomainNode {
  return {
    name,
    slug: slugify(name),
    section,
    skills: skills.map(([skillName, blurb]) => ({
      name: skillName,
      slug: slugify(skillName),
      blurb,
    })),
  };
}

export const DOMAINS: DomainNode[] = [
  domain("Reading and Writing", "Information and Ideas", [
    [
      "Central Ideas and Details",
      "Identify the main point of a text and distinguish it from supporting detail.",
    ],
    [
      "Command of Evidence (Textual)",
      "Choose the quotation or detail that most directly supports a claim.",
    ],
    [
      "Command of Evidence (Quantitative)",
      "Read a table or graph and pick the data point that supports a claim.",
    ],
    [
      "Inferences",
      "Complete a text with the conclusion most logically supported by it.",
    ],
  ]),
  domain("Reading and Writing", "Craft and Structure", [
    [
      "Words in Context",
      "Choose the word or phrase that best fits the meaning and tone of a passage.",
    ],
    [
      "Text Structure and Purpose",
      "Describe how a text is organized or why a part of it is included.",
    ],
    [
      "Cross-Text Connections",
      "Compare how two texts relate on a shared topic or claim.",
    ],
  ]),
  domain("Reading and Writing", "Standard English Conventions", [
    [
      "Boundaries",
      "Punctuate sentence boundaries, clauses, and supplements correctly.",
    ],
    [
      "Form, Structure, and Sense",
      "Apply subject-verb agreement, verb form, pronouns, and modifier placement.",
    ],
  ]),
  domain("Reading and Writing", "Expression of Ideas", [
    [
      "Rhetorical Synthesis",
      "Use given notes to accomplish a stated rhetorical goal.",
    ],
    [
      "Transitions",
      "Choose the transition that matches the logical relationship between ideas.",
    ],
  ]),
  domain("Math", "Algebra", [
    ["Linear Equations in One Variable", "Solve and interpret one-variable linear equations."],
    ["Linear Functions", "Interpret slope, intercepts, and linear models in context."],
    ["Linear Equations in Two Variables", "Work with lines in two variables and their graphs."],
    ["Systems of Two Linear Equations", "Solve systems and interpret their solutions."],
    ["Linear Inequalities", "Solve and graph linear inequalities in one or two variables."],
  ]),
  domain("Math", "Advanced Math", [
    ["Equivalent Expressions", "Rewrite, factor, and simplify polynomial and rational expressions."],
    ["Nonlinear Equations and Systems", "Solve quadratic, radical, exponential, and mixed systems."],
    ["Nonlinear Functions", "Interpret quadratic, exponential, and other nonlinear models."],
  ]),
  domain("Math", "Problem-Solving and Data Analysis", [
    ["Ratios, Rates, and Units", "Work with proportional relationships and unit conversion."],
    ["Percentages", "Compute and interpret percent change, discounts, and growth."],
    ["One-Variable Data and Distributions", "Interpret center, spread, and shape of a data set."],
    ["Two-Variable Data and Models", "Read scatterplots and fit or interpret models."],
    ["Probability and Conditional Probability", "Compute probabilities from tables and contexts."],
    ["Inference from Samples and Margin of Error", "Reason about samples, estimates, and error."],
    ["Evaluating Statistical Claims", "Judge whether a study design supports a conclusion."],
  ]),
  domain("Math", "Geometry and Trigonometry", [
    ["Area and Volume", "Apply area, surface area, and volume formulas."],
    ["Lines, Angles, and Triangles", "Use angle relationships, similarity, and congruence."],
    ["Right Triangles and Trigonometry", "Apply the Pythagorean theorem and trig ratios."],
    ["Circles", "Work with arcs, sectors, angles, and circle equations."],
  ]),
];

export const ALL_SKILLS: (SkillNode & { domain: string; section: Section })[] =
  DOMAINS.flatMap((d) =>
    d.skills.map((s) => ({ ...s, domain: d.name, section: d.section })),
  );

export const SKILL_NAMES: string[] = ALL_SKILLS.map((s) => s.name);
export const DOMAIN_NAMES: string[] = DOMAINS.map((d) => d.name);

export function findSkill(slugOrName: string) {
  const needle = slugOrName.toLowerCase();
  return ALL_SKILLS.find(
    (s) => s.slug === needle || s.name.toLowerCase() === needle,
  );
}

export function findDomain(slugOrName: string) {
  const needle = slugOrName.toLowerCase();
  return DOMAINS.find(
    (d) => d.slug === needle || d.name.toLowerCase() === needle,
  );
}

export function domainForSkill(skillName: string): DomainNode | undefined {
  return DOMAINS.find((d) => d.skills.some((s) => s.name === skillName));
}

/**
 * The AI classifies into this fixed vocabulary so mistake types stay
 * comparable across questions -- that comparability is what makes recurring
 * pattern detection possible.
 */
export const MISTAKE_TYPES = [
  "conceptual_misunderstanding",
  "misreading",
  "calculation_error",
  "incorrect_interpretation",
  "distractor_selection",
  "strategy_issue",
  "knowledge_gap",
  "missed_faster_solution",
] as const;

export type MistakeType = (typeof MISTAKE_TYPES)[number];

export const MISTAKE_LABELS: Record<MistakeType, string> = {
  conceptual_misunderstanding: "Conceptual misunderstanding",
  misreading: "Misreading",
  calculation_error: "Calculation error",
  incorrect_interpretation: "Incorrect interpretation",
  distractor_selection: "Distractor selection",
  strategy_issue: "Strategy issue",
  knowledge_gap: "Knowledge gap",
  missed_faster_solution: "Missed a faster solution",
};

export const MISTAKE_DESCRIPTIONS: Record<MistakeType, string> = {
  conceptual_misunderstanding:
    "The underlying rule or concept is misunderstood, not just misapplied.",
  misreading:
    "The text, question stem, or figure was read inaccurately or incompletely.",
  calculation_error:
    "The approach was right but the arithmetic or algebra went wrong.",
  incorrect_interpretation:
    "The work was correct but the result was mapped to the wrong answer.",
  distractor_selection:
    "A deliberately tempting wrong choice was picked over the correct one.",
  strategy_issue:
    "A workable but inefficient or error-prone approach was chosen.",
  knowledge_gap: "A required fact, formula, or rule was not known.",
  missed_faster_solution:
    "The answer was reachable far more quickly by another route.",
};
