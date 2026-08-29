/**
 * Seeds SATLens with a realistic practice history so the dashboard, error log,
 * patterns, and progress tracking can be exercised without spending API calls.
 *
 * All question text here is original, written for this fixture.
 *
 *   node scripts/seed.mjs [--reset]
 *
 * Requires the schema to already exist (start the app once, or it will be
 * created by the app on first run).
 */
import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(process.env.SATLENS_DB_PATH ?? path.join(process.cwd(), "satlens.db"));
db.pragma("foreign_keys = ON");

if (process.argv.includes("--reset")) {
  db.exec(`DELETE FROM pattern_evidence; DELETE FROM patterns; DELETE FROM diagnoses;
           DELETE FROM attempts; DELETE FROM practice_items; DELETE FROM profile;`);
  console.log("cleared existing data");
}

let n = 0;
const id = (p) => `${p}_seed${(++n).toString(36).padStart(3, "0")}`;
const iso = (d) => `${d}T12:00:00.000Z`;

const C = (a, b, c, d) => JSON.stringify([
  { label: "A", text: a }, { label: "B", text: b },
  { label: "C", text: c }, { label: "D", text: d },
]);

const insertAttempt = db.prepare(`
  INSERT INTO attempts (id, created_at, occurred_on, source, source_label, section, domain, skill,
    difficulty, passage, question_text, choices, student_answer, correct_answer, is_correct,
    student_reasoning, time_spent_seconds, practice_item_id, retest_pattern_id, analyzed)
  VALUES (@id, @created_at, @occurred_on, @source, @source_label, @section, @domain, @skill,
    @difficulty, @passage, @question_text, @choices, @student_answer, @correct_answer, @is_correct,
    @student_reasoning, @time_spent_seconds, NULL, @retest_pattern_id, @analyzed)`);

const insertDiagnosis = db.prepare(`
  INSERT INTO diagnoses (id, attempt_id, created_at, mistake_type, headline, explanation,
    concept, faster_solution, trap, confidence)
  VALUES (@id, @attempt_id, @created_at, @mistake_type, @headline, @explanation,
    @concept, @faster_solution, @trap, @confidence)`);

/** Add one attempt; if `dx` is given the attempt is marked diagnosed. */
function add(a, dx) {
  const attemptId = id("att");
  const correct = a.student_answer.trim().toLowerCase() === a.correct_answer.trim().toLowerCase();
  insertAttempt.run({
    id: attemptId,
    created_at: iso(a.date),
    occurred_on: a.date,
    source: a.source ?? "manual",
    source_label: a.label ?? null,
    section: a.section,
    domain: a.domain,
    skill: a.skill,
    difficulty: a.difficulty ?? "medium",
    passage: a.passage ?? null,
    question_text: a.q,
    choices: a.choices ?? null,
    student_answer: a.student_answer,
    correct_answer: a.correct_answer,
    is_correct: correct ? 1 : 0,
    student_reasoning: a.reasoning ?? null,
    time_spent_seconds: a.time ?? null,
    retest_pattern_id: null,
    analyzed: dx ? 1 : 0,
  });
  if (dx) {
    insertDiagnosis.run({
      id: id("dx"), attempt_id: attemptId, created_at: iso(a.date),
      mistake_type: dx.type, headline: dx.headline, explanation: dx.explanation,
      concept: dx.concept, faster_solution: dx.faster ?? null, trap: dx.trap ?? null,
      confidence: dx.confidence ?? 0.82,
    });
  }
  return attemptId;
}

const RW = "Reading and Writing";
const MATH = "Math";
const INFO = "Information and Ideas";
const CRAFT = "Craft and Structure";
const CONV = "Standard English Conventions";
const EXPR = "Expression of Ideas";
const ALG = "Algebra";
const ADV = "Advanced Math";
const PSDA = "Problem-Solving and Data Analysis";

const CENTRAL = "Central Ideas and Details";
const INFER = "Inferences";
const EVID = "Command of Evidence (Textual)";
const WORDS = "Words in Context";
const BOUND = "Boundaries";
const TRANS = "Transitions";
const LINFN = "Linear Functions";
const NONLIN = "Nonlinear Equations and Systems";
const EQUIV = "Equivalent Expressions";
const PCT = "Percentages";

/* ------------------------------------------------------------------------ */
/* Test 1 -- Aug 10. The central-ideas habit shows up immediately.           */
/* ------------------------------------------------------------------------ */

const central1 = add({
  date: "2026-08-10", label: "Practice Test 1", section: RW, domain: INFO, skill: CENTRAL,
  passage:
    "Marine biologist Sana Oyelaran spent eleven seasons cataloguing the sponge beds of the Aleutian shelf. Her published surveys are exhaustive, running to hundreds of pages of measurements. Yet Oyelaran has argued that the surveys' real contribution is not the catalogue itself. Cataloguing, she notes, had been done before. What her seasons on the shelf established was that the beds shift position year over year -- a finding that overturned the assumption of a static seafloor and forced a redesign of how the region's fisheries are monitored.",
  q: "Which choice best states the main idea of the text?",
  choices: C(
    "Oyelaran's surveys are notable for the sheer volume of measurements they contain.",
    "Oyelaran spent eleven seasons studying sponge beds in the Aleutian shelf.",
    "Oyelaran's most important contribution was showing that the sponge beds move over time.",
    "Fisheries monitoring in the Aleutian region has been redesigned in recent years.",
  ),
  student_answer: "A", correct_answer: "C", difficulty: "medium", time: 96,
  reasoning: "The passage kept emphasizing how exhaustive and long the surveys were, so I went with the volume of measurements.",
}, {
  type: "distractor_selection",
  headline: "Picked a true supporting detail instead of the passage's actual claim.",
  explanation:
    "Choice A is accurate -- the text does say the surveys run to hundreds of pages. But the passage explicitly sets that detail aside: 'the surveys' real contribution is not the catalogue itself.' You latched onto the most vivid concrete detail rather than the sentence that tells you what the passage is for. C is the claim the whole paragraph builds to.",
  concept:
    "In a main-idea question, the correct answer is the claim every other sentence serves. A choice can be completely true and still be wrong, because it is a supporting detail rather than the point.",
  trap: "A restates a real detail from the text, which makes it feel verifiable and safe.",
  faster: "Find the sentence with the pivot word ('Yet', 'But', 'However'). On SAT main-idea questions the thesis almost always sits right after it.",
  confidence: 0.88,
});

const central2 = add({
  date: "2026-08-10", label: "Practice Test 1", section: RW, domain: INFO, skill: CENTRAL,
  passage:
    "Restoration crews working on the 14th-century frescoes at Assisi faced a choice. Reversible acrylic consolidants would hold the flaking pigment for perhaps forty years and could be removed by a future conservator. Traditional lime-casein would likely last centuries but could never be undone. The crews chose the acrylics. Their reasoning was not that acrylics perform better -- they do not -- but that a conservator in 2060 will know things they do not, and should not be locked out of the decision.",
  q: "Which choice best describes the main idea of the text?",
  choices: C(
    "Acrylic consolidants preserve flaking pigment for roughly forty years.",
    "The crews chose the reversible option in order to preserve future conservators' freedom to choose.",
    "Lime-casein is more durable than acrylic consolidants.",
    "The frescoes at Assisi date to the 14th century and are badly flaked.",
  ),
  student_answer: "C", correct_answer: "B", difficulty: "hard", time: 118,
  reasoning: "C is definitely stated in the passage — lime-casein lasts centuries and acrylic only forty years.",
}, {
  type: "distractor_selection",
  headline: "Chose a verifiable detail over the reasoning the passage is actually about.",
  explanation:
    "You said C 'is definitely stated' -- and it is. That is the problem. The final sentence tells you the crews' reasoning explicitly, and the entire paragraph exists to set up that reasoning. C is a premise inside the argument, not the argument. This is the same move as the Oyelaran question: you are treating 'is this stated?' as the test, when the test is 'is this what the text is for?'",
  concept:
    "Confirming a choice appears in the passage only rules it out as false. Main idea asks which claim the other sentences exist to support.",
  trap: "C is a directly checkable fact, so it feels safer than the more abstract correct answer.",
  confidence: 0.9,
});

add({
  date: "2026-08-10", label: "Practice Test 1", section: RW, domain: INFO, skill: INFER,
  q: "Which choice most logically completes the text?",
  passage:
    "Sourdough starters maintained in different kitchens diverge within weeks, developing distinct microbial communities even when they began as portions of the same culture. Bakers often attribute this to their flour or water. But researchers who controlled for both found the divergence persisted, suggesting that the decisive variable is instead ______",
  choices: C(
    "the mineral content of the water used to feed the starter.",
    "the specific microorganisms already present on the baker's hands and surfaces.",
    "the brand of flour the baker prefers.",
    "the age of the original culture the portions were taken from.",
  ),
  student_answer: "B", correct_answer: "B", difficulty: "medium", time: 74,
});

add({
  date: "2026-08-10", label: "Practice Test 1", section: RW, domain: CONV, skill: BOUND,
  q: "Which choice completes the text so that it conforms to the conventions of Standard English?",
  passage: "The archive holds letters from three cartographers ______ each of whom mapped a different stretch of the coast.",
  choices: C("cartographers,", "cartographers;", "cartographers:", "cartographers"),
  student_answer: "A", correct_answer: "A", difficulty: "medium", time: 41,
});

add({
  date: "2026-08-10", label: "Practice Test 1", section: MATH, domain: ALG, skill: LINFN,
  q: "A rental company charges a flat fee plus a per-mile rate. A 40-mile trip costs $71 and a 100-mile trip costs $131. What is the flat fee, in dollars?",
  choices: C("$25", "$31", "$35", "$40"),
  student_answer: "B", correct_answer: "B", difficulty: "easy", time: 62,
});

const nonlin1 = add({
  date: "2026-08-10", label: "Practice Test 1", section: MATH, domain: ADV, skill: NONLIN,
  q: "If √(2x + 15) = x, what is the value of x?",
  choices: C("-3", "5", "-3 and 5", "No solution"),
  student_answer: "C", correct_answer: "B", difficulty: "medium", time: 105,
  reasoning: "I squared both sides and factored to get x = -3 and x = 5, so I picked both.",
}, {
  type: "conceptual_misunderstanding",
  headline: "Solved the squared equation but never checked for extraneous roots.",
  explanation:
    "Squaring both sides is a valid step, but it can introduce solutions the original equation never had. x = -3 gives √9 = 3, and 3 ≠ -3, so -3 is extraneous. You did the algebra correctly and then skipped the verification step that radical equations always require.",
  concept:
    "Squaring is not a reversible operation. Every solution to a radical equation must be substituted back into the ORIGINAL equation before it counts.",
  faster: "A square root is never negative, so x must be ≥ 0 before you factor anything. That alone eliminates -3 and kills choices A and C instantly.",
  trap: "Choice C is built for exactly this error -- it offers both algebraic roots.",
  confidence: 0.93,
});

/* ------------------------------------------------------------------------ */
/* Test 2 -- Aug 15.                                                         */
/* ------------------------------------------------------------------------ */

const central3 = add({
  date: "2026-08-15", label: "Practice Test 2", section: RW, domain: INFO, skill: CENTRAL,
  passage:
    "For decades the standard account held that the Nazca lines were built as astronomical markers. The alignment evidence was suggestive: a handful of the long straight lines do point toward solstice positions. But when archaeologist Ruth Delgado tested all similar lines rather than the selected few, the alignments proved no better than chance. The astronomical account, she concluded, had been built by looking only at the cases that fit.",
  q: "Which choice best states the main idea of the text?",
  choices: C(
    "Some Nazca lines point toward solstice positions.",
    "Ruth Delgado is an archaeologist who studies the Nazca lines.",
    "The astronomical explanation of the Nazca lines rests on selectively chosen evidence.",
    "The Nazca lines were built for a purpose that remains unknown.",
  ),
  student_answer: "A", correct_answer: "C", difficulty: "medium", time: 88,
  reasoning: "A is the thing the passage actually establishes as true about the lines.",
}, {
  type: "distractor_selection",
  headline: "Again chose the concrete detail over the passage's critical claim.",
  explanation:
    "A is the passage's setup, not its point. The text presents the solstice alignments precisely so it can knock them down two sentences later. Your note -- 'the thing the passage actually establishes as true' -- is the tell: you are searching for the most factually solid statement rather than the author's argument. This is now the third time on this skill.",
  concept:
    "When a passage presents a claim and then a rebuttal, the main idea lives in the rebuttal. The setup exists to be overturned.",
  trap: "A is drawn word-for-word from the passage's second sentence.",
  confidence: 0.91,
});

add({
  date: "2026-08-15", label: "Practice Test 2", section: RW, domain: CRAFT, skill: WORDS,
  q: "As used in the text, what does the word 'arresting' most nearly mean?",
  passage: "The most arresting feature of the new concert hall is not its acoustics but its roofline, which draws the eye from three streets away.",
  choices: C("Detaining", "Striking", "Stopping", "Troubling"),
  student_answer: "B", correct_answer: "B", difficulty: "easy", time: 33,
});

const trans1 = add({
  date: "2026-08-15", label: "Practice Test 2", section: RW, domain: EXPR, skill: TRANS,
  q: "Which choice completes the text with the most logical transition?",
  passage: "The alloy resists corrosion far better than steel and costs less to produce at scale. ______ its brittleness at low temperatures has kept it out of aerospace applications.",
  choices: C("Therefore,", "Similarly,", "Nevertheless,", "For instance,"),
  student_answer: "A", correct_answer: "C", difficulty: "medium", time: 51,
  reasoning: "The first sentence lists good properties so I thought the second was the result of them.",
}, {
  type: "incorrect_interpretation",
  headline: "Read a contrast as a consequence.",
  explanation:
    "The first sentence lists advantages; the second names a drawback that blocks a use case. That is opposition, not result. You appear to have chosen the transition from the tone of the first sentence alone without checking the direction of the second.",
  concept:
    "Read the sentence AFTER the blank before choosing. The transition encodes the relationship between the two, and only the second sentence tells you the direction.",
  faster: "Cover the choices, decide 'same direction or opposite' in your own words first, then eliminate. Half the options usually die immediately.",
  confidence: 0.85,
});

const nonlin2 = add({
  date: "2026-08-15", label: "Practice Test 2", section: MATH, domain: ADV, skill: NONLIN,
  q: "If x - 4 = √(x + 8), what is the sum of all valid solutions?",
  choices: C("1", "8", "9", "17"),
  student_answer: "C", correct_answer: "B", difficulty: "hard", time: 142,
  reasoning: "Squaring gave x² - 9x + 8 = 0, so x = 1 and x = 8, and 1 + 8 = 9.",
}, {
  type: "conceptual_misunderstanding",
  headline: "Same radical equation error: kept a root that fails the original equation.",
  explanation:
    "Your factoring was right. But x = 1 gives 1 - 4 = -3 on the left and √9 = 3 on the right, so it is extraneous. Only x = 8 survives, making the sum 8. This is the identical mechanism from Practice Test 1: correct algebra, missing verification step.",
  concept:
    "For √(expression) = something, the right-hand side must be ≥ 0. Check that constraint before you even factor.",
  faster: "x - 4 must be ≥ 0, so x ≥ 4. That kills x = 1 before you do any arithmetic.",
  trap: "Choice C is the sum you get if you keep both roots.",
  confidence: 0.94,
});

add({
  date: "2026-08-15", label: "Practice Test 2", section: MATH, domain: PSDA, skill: PCT,
  q: "A jacket is discounted 30%, then an additional 20% is taken off the sale price. The final price is what percent of the original?",
  choices: C("50%", "54%", "56%", "60%"),
  student_answer: "C", correct_answer: "C", difficulty: "medium", time: 71,
});

add({
  date: "2026-08-15", label: "Practice Test 2", section: MATH, domain: ALG, skill: LINFN,
  q: "The function f(x) = 12 - 1.5x models the amount of fuel, in gallons, remaining after x hours. What does 1.5 represent?",
  choices: C("Fuel at the start", "Gallons used per hour", "Hours until empty", "Total capacity"),
  student_answer: "B", correct_answer: "B", difficulty: "easy", time: 38,
});

const equiv1 = add({
  date: "2026-08-15", label: "Practice Test 2", section: MATH, domain: ADV, skill: EQUIV,
  q: "Which expression is equivalent to (3x² - 12) / (x² - 4x + 4) for x ≠ 2?",
  choices: C("3(x+2)/(x-2)", "3(x-2)/(x+2)", "3(x+2)/(x+2)", "3"),
  student_answer: "B", correct_answer: "A", difficulty: "hard", time: 128,
  reasoning: "I factored the top as 3(x-2)(x+2) and the bottom as (x-2)², then cancelled but mixed up which factor was left.",
}, {
  type: "calculation_error",
  headline: "Factored correctly, then cancelled the wrong factor.",
  explanation:
    "3x² - 12 = 3(x-2)(x+2) and x² - 4x + 4 = (x-2)². Cancelling one (x-2) leaves 3(x+2)/(x-2). You inverted the surviving factors. The method was completely right; the bookkeeping at the last step was not.",
  concept:
    "After cancelling, write out what remains in the numerator and denominator explicitly rather than tracking it mentally.",
  confidence: 0.8,
});

/* ------------------------------------------------------------------------ */
/* Test 3 -- Aug 20. Last appearance of the central-ideas pattern.           */
/* ------------------------------------------------------------------------ */

const central4 = add({
  date: "2026-08-20", label: "Practice Test 3", section: RW, domain: INFO, skill: CENTRAL,
  passage:
    "The Voyager probes carry a gold-plated record of sounds and images from Earth. Commentators often describe it as a message to extraterrestrials. Carl Sagan, who chaired the committee that assembled it, was blunt about the odds of interception: essentially zero. The record's purpose, he said, was terrestrial. Deciding what to put on it required a species to articulate, for the first time, what it thought was worth saying about itself.",
  q: "Which choice best states the main idea of the text?",
  choices: C(
    "The Voyager record contains sounds and images selected from Earth.",
    "Carl Sagan chaired the committee that assembled the Voyager record.",
    "The odds that extraterrestrials will intercept the record are essentially zero.",
    "The record's real value lay in forcing humanity to define what it valued.",
  ),
  student_answer: "C", correct_answer: "D", difficulty: "hard", time: 109,
  reasoning: "Sagan's point was that nobody will ever find it, which felt like the big claim.",
}, {
  type: "distractor_selection",
  headline: "Took the concession as the thesis instead of what it sets up.",
  explanation:
    "The near-zero odds are real and Sagan did say it -- but he says it to clear the way for his actual claim, which arrives in the last two sentences: the record's purpose was terrestrial. You stopped at the striking factual statement instead of following the paragraph to its conclusion. Fourth instance of the same move.",
  concept:
    "A concession ('the odds are essentially zero') is a step in the argument. The thesis is usually what the author says INSTEAD, and it typically closes the paragraph.",
  trap: "C is the most surprising fact in the text, which makes it feel important.",
  confidence: 0.89,
});

const evid1 = add({
  date: "2026-08-20", label: "Practice Test 3", section: RW, domain: INFO, skill: EVID,
  q: "Which quotation from the researcher's notes most directly supports the claim that the colony relocated in response to temperature rather than food supply?",
  choices: C(
    "\"Krill density in the original bay was unchanged through the season.\"",
    "\"The colony's new site lies 40 kilometres north of the old one.\"",
    "\"Water temperature at the original site rose 2.1°C over six weeks, and the move began in week five.\"",
    "\"Colonies of this species have relocated in three of the past ten seasons.\"",
  ),
  student_answer: "A", correct_answer: "C", difficulty: "hard", time: 97,
  reasoning: "A rules out food supply, which is the other option in the claim.",
}, {
  type: "strategy_issue",
  headline: "Supported half the claim by elimination instead of supporting it directly.",
  explanation:
    "A does useful work -- it weakens the food-supply explanation. But the claim has two halves, and A is silent on temperature. C establishes both the temperature change and its timing relative to the move. Ruling out an alternative is weaker evidence than demonstrating the mechanism.",
  concept:
    "For a 'X rather than Y' claim, prefer evidence that positively establishes X. Evidence that only rules out Y leaves the claim unsupported.",
  confidence: 0.83,
});

add({
  date: "2026-08-20", label: "Practice Test 3", section: RW, domain: CONV, skill: BOUND,
  q: "Which choice conforms to the conventions of Standard English?",
  passage: "The survey covered four provinces ______ two of which had never been mapped at that resolution.",
  choices: C("provinces;", "provinces,", "provinces:", "provinces"),
  student_answer: "B", correct_answer: "B", difficulty: "medium", time: 44,
});

add({
  date: "2026-08-20", label: "Practice Test 3", section: RW, domain: EXPR, skill: TRANS,
  q: "Which choice completes the text with the most logical transition?",
  passage: "Early prototypes failed within days of continuous use. ______ the current model has run for eight months without servicing.",
  choices: C("Consequently,", "By contrast,", "In addition,", "For example,"),
  student_answer: "B", correct_answer: "B", difficulty: "medium", time: 39,
});

add({
  date: "2026-08-20", label: "Practice Test 3", section: MATH, domain: ALG, skill: LINFN,
  q: "Line ℓ passes through (2, 7) and (6, 19). What is its slope?",
  choices: C("2", "3", "4", "6"),
  student_answer: "B", correct_answer: "B", difficulty: "easy", time: 35,
});

add({
  date: "2026-08-20", label: "Practice Test 3", section: MATH, domain: PSDA, skill: PCT,
  q: "A population grows from 8,400 to 9,660. What is the percent increase?",
  choices: C("13%", "15%", "16%", "18%"),
  student_answer: "B", correct_answer: "B", difficulty: "medium", time: 58,
});

const equiv2 = add({
  date: "2026-08-20", label: "Practice Test 3", section: MATH, domain: ADV, skill: EQUIV,
  q: "If (2x + 5)(x - 3) = 2x² + ax - 15, what is the value of a?",
  choices: C("-11", "-1", "1", "11"),
  student_answer: "C", correct_answer: "B", difficulty: "medium", time: 66,
  reasoning: "I got the x terms as -6x and 5x and added them as +1x.",
}, {
  type: "calculation_error",
  headline: "Sign slip when combining the middle terms.",
  explanation:
    "Expanding gives 2x² - 6x + 5x - 15. Combining -6x and +5x gives -1x, not +1x. You wrote the magnitude correctly and lost the sign. Choice C exists specifically to catch this.",
  concept:
    "When combining like terms with mixed signs, write the sum out (-6 + 5 = -1) rather than doing it in your head.",
  trap: "Both +1 and -1 are offered, so a sign slip lands on a real answer choice.",
  confidence: 0.87,
});

/* ------------------------------------------------------------------------ */
/* Aug 22-28 -- targeted work. Central Ideas recovers; radicals do not yet.  */
/* ------------------------------------------------------------------------ */

add({
  date: "2026-08-22", label: "Targeted practice", source: "practice", section: RW, domain: INFO, skill: CENTRAL,
  q: "Which choice best states the main idea of the text?",
  passage:
    "Municipal composting programs are usually justified by the volume they divert from landfill. The city of Ferrand's own audit found the diverted tonnage modest. What the audit did find was that households enrolled in the program cut their overall waste output by nearly a fifth -- not because composting removed material, but because separating it made people notice how much they were throwing away.",
  choices: C(
    "Ferrand's composting program diverted a modest tonnage from landfill.",
    "The program's main effect was behavioural: sorting waste changed how much households produced.",
    "Composting programs are usually justified by landfill diversion.",
    "Households in Ferrand cut their waste output by nearly twenty percent.",
  ),
  student_answer: "B", correct_answer: "B", difficulty: "medium", time: 79,
  reasoning: "The 'not because... but because' at the end tells you what the passage is actually claiming, so I followed it there instead of picking the tonnage fact.",
});

add({
  date: "2026-08-25", label: "Targeted practice", source: "practice", section: RW, domain: INFO, skill: CENTRAL,
  q: "Which choice best states the main idea of the text?",
  passage:
    "Handwriting instruction was dropped from many curricula on the grounds that keyboards had made it obsolete. Studies of note-taking complicate that reasoning. Students typing notes record more words, but students writing by hand perform better on conceptual questions afterward -- apparently because the slower medium forces them to summarize rather than transcribe.",
  choices: C(
    "Students who type record more words than students who write by hand.",
    "Handwriting instruction has been dropped from many curricula.",
    "Writing by hand aids understanding because its slowness forces summarizing.",
    "Keyboards have made handwriting obsolete in most settings.",
  ),
  student_answer: "C", correct_answer: "C", difficulty: "medium", time: 68,
  reasoning: "A is true but it's the setup for the contrast. The claim is in the second half.",
});

const nonlin3 = add({
  date: "2026-08-25", label: "Targeted practice", source: "practice", section: MATH, domain: ADV, skill: NONLIN,
  q: "If √(3x + 4) = x - 2, what is the value of x?",
  choices: C("0", "5", "8", "0 and 5"),
  student_answer: "D", correct_answer: "C", difficulty: "hard", time: 133,
  reasoning: "Squared it, got x² - 7x = 0, so x = 0 or x = 7... I second-guessed and picked D.",
}, {
  type: "conceptual_misunderstanding",
  headline: "Third time: kept extraneous roots on a radical equation.",
  explanation:
    "Squaring gives x² - 4x + 4 = 3x + 4, so x² - 7x = 0 and x = 0 or 7. Neither of those is what you selected, and the arithmetic slipped too. But the root problem is unchanged: you are not applying the x - 2 ≥ 0 constraint, which requires x ≥ 2 and rules out 0 immediately.",
  concept:
    "Before solving any √A = B equation, write down B ≥ 0 as a constraint. Apply it to your roots at the end, every time.",
  faster: "Test the choices directly. With four numeric options, substitution is faster than squaring and cannot produce an extraneous root.",
  confidence: 0.9,
});

add({
  date: "2026-08-27", label: "Targeted practice", source: "practice", section: RW, domain: INFO, skill: CENTRAL,
  q: "Which choice best states the main idea of the text?",
  passage:
    "Botanist Ines Roth's herbarium contains 40,000 pressed specimens, and it is often cited as the largest private collection of its kind. Roth herself has said the number is beside the point. Because she recorded precise collection dates for every specimen across sixty years, the herbarium functions as a time series -- which is what allowed later researchers to date the shift in regional flowering times.",
  choices: C(
    "Roth's herbarium is the largest private collection of its kind.",
    "The herbarium's value comes from its dated records, which make it usable as a time series.",
    "Roth collected specimens over a period of sixty years.",
    "Regional flowering times have shifted in recent decades.",
  ),
  student_answer: "B", correct_answer: "B", difficulty: "hard", time: 71,
  reasoning: "'Roth herself has said the number is beside the point' — that sentence is the author telling you not to pick the size fact.",
});

add({
  date: "2026-08-28", label: "Targeted practice", source: "practice", section: RW, domain: INFO, skill: CENTRAL,
  q: "Which choice best states the main idea of the text?",
  passage:
    "The 1918 influenza pandemic is often described as having killed more people than the First World War. The comparison is accurate but has had an odd effect: it frames the pandemic as a single catastrophic event. Historians who work from parish records instead describe something closer to a slow institutional failure, in which the same warnings were ignored in the same ways across dozens of municipalities.",
  choices: C(
    "The 1918 pandemic killed more people than the First World War.",
    "Parish records are a valuable source for historians of the pandemic.",
    "Framing the pandemic as one catastrophe obscures the repeated institutional failures behind it.",
    "Municipalities ignored warnings during the 1918 pandemic.",
  ),
  student_answer: "C", correct_answer: "C", difficulty: "hard", time: 82,
});

add({
  date: "2026-08-28", label: "Targeted practice", source: "practice", section: MATH, domain: ADV, skill: NONLIN,
  q: "If √(x + 6) = x, what is the value of x?",
  choices: C("-2", "3", "-2 and 3", "No solution"),
  student_answer: "B", correct_answer: "B", difficulty: "medium", time: 64,
  reasoning: "Checked the constraint first this time — x has to be ≥ 0, so -2 is out before I even factor.",
});

/* ------------------------------------------------------------------------ */
/* Patterns                                                                  */
/* ------------------------------------------------------------------------ */

const insertPattern = db.prepare(`
  INSERT INTO patterns (id, created_at, updated_at, title, description, recommendation,
    section, domain, skill, mistake_type, severity, status, first_seen, last_seen)
  VALUES (@id, @created_at, @updated_at, @title, @description, @recommendation,
    @section, @domain, @skill, @mistake_type, @severity, 'active', @first_seen, @last_seen)`);
const insertEvidence = db.prepare(
  `INSERT OR IGNORE INTO pattern_evidence (pattern_id, attempt_id, note) VALUES (?, ?, ?)`);

function pattern(p, evidence) {
  const pid = id("pat");
  insertPattern.run({ id: pid, created_at: iso(p.last_seen), updated_at: iso(p.last_seen), ...p, id: pid });
  for (const [attemptId, note] of evidence) insertEvidence.run(pid, attemptId, note);
  return pid;
}

pattern({
  title: "Chooses detail-supported answers over the passage's central claim",
  description:
    "On main-idea questions you consistently select the choice that is most easily verified against the text rather than the one the text is built to argue. Your own notes make the mechanism explicit -- 'the thing the passage actually establishes as true', 'C is definitely stated' -- you are testing choices for factual presence rather than for argumentative role. It fires hardest when the passage opens with a vivid concrete detail and puts its thesis after a pivot ('Yet', 'But', 'The record's purpose, he said').",
  recommendation:
    "Before looking at the choices, find the pivot word and read the sentence after it aloud in your own words. That sentence is the thesis. Then reject any choice that is merely true -- ask 'is this what the other sentences exist to support?' rather than 'is this stated?'",
  section: RW, domain: INFO, skill: CENTRAL, mistake_type: "distractor_selection",
  severity: "high", first_seen: "2026-08-10", last_seen: "2026-08-20",
}, [
  [central1, "Picked the 'hundreds of pages' detail even though the passage explicitly set it aside."],
  [central2, "Chose the durability premise over the crews' stated reasoning; note said 'C is definitely stated'."],
  [central3, "Selected the solstice-alignment setup that the passage then rebuts."],
  [central4, "Took Sagan's concession about the odds as the thesis instead of what it sets up."],
]);

pattern({
  title: "Skips the extraneous-root check on radical equations",
  description:
    "You solve radical equations by squaring both sides and factoring -- correctly, every time -- and then stop. You never substitute back or impose the domain constraint that squaring destroys. Across three questions you kept a root that fails the original equation, and in each case the answer sheet offered 'both roots' as a choice, which you took twice.",
  recommendation:
    "Write the constraint before you square: for √A = B, note 'B ≥ 0' at the top of your work. When you finish factoring, cross out any root that violates it. With four numeric choices, testing them directly is often faster than squaring at all.",
  section: MATH, domain: ADV, skill: NONLIN, mistake_type: "conceptual_misunderstanding",
  severity: "high", first_seen: "2026-08-10", last_seen: "2026-08-25",
}, [
  [nonlin1, "Chose 'both -3 and 5' when -3 fails the original equation."],
  [nonlin2, "Summed both roots including the extraneous x = 1."],
  [nonlin3, "Still not applying the x - 2 ≥ 0 constraint, three tests in."],
]);

pattern({
  title: "Sign and bookkeeping slips in the final step of algebraic manipulation",
  description:
    "Your method on expression questions is sound and you reach the last step correctly, then lose a sign or invert which factor survives. Both instances came after longer-than-average work, and both had the mirror-image wrong answer available as a choice.",
  recommendation:
    "Slow down for the final line specifically. Write out combinations explicitly (-6 + 5 = -1) instead of doing them mentally, and after cancelling, rewrite the surviving numerator and denominator on a fresh line.",
  section: MATH, domain: ADV, skill: EQUIV, mistake_type: "calculation_error",
  severity: "moderate", first_seen: "2026-08-15", last_seen: "2026-08-20",
}, [
  [equiv1, "Inverted which factor remained after cancelling (x-2)."],
  [equiv2, "Combined -6x and +5x as +1x instead of -1x."],
]);

pattern({
  title: "Supports 'X rather than Y' claims by ruling out Y",
  description:
    "On evidence questions with a comparative claim, you pick the quotation that undercuts the alternative explanation instead of the one that positively establishes the mechanism. Eliminating the rival leaves the claim itself unsupported.",
  recommendation:
    "Split the claim into its two halves and check which half each quotation speaks to. Prefer the choice that supplies the mechanism and its timing over the one that merely removes a competitor.",
  section: RW, domain: INFO, skill: EVID, mistake_type: "strategy_issue",
  severity: "low", first_seen: "2026-08-20", last_seen: "2026-08-20",
}, [
  [evid1, "Chose the krill-density quotation, which only rules out the food-supply explanation."],
  [trans1, "Related failure to check the second half of a relationship before committing."],
]);

db.prepare(
  `INSERT INTO profile (id, test_date, target_score, current_score, hours_per_week, updated_at)
   VALUES (1, '2026-11-07', 1500, 1370, 8, ?)
   ON CONFLICT(id) DO UPDATE SET test_date = excluded.test_date, target_score = excluded.target_score,
     current_score = excluded.current_score, hours_per_week = excluded.hours_per_week`,
).run(iso("2026-08-28"));

const counts = db.prepare(
  `SELECT (SELECT COUNT(*) FROM attempts) a, (SELECT COUNT(*) FROM diagnoses) d,
          (SELECT COUNT(*) FROM patterns) p, (SELECT COUNT(*) FROM pattern_evidence) e`,
).get();
console.log(`seeded: ${counts.a} attempts, ${counts.d} diagnoses, ${counts.p} patterns, ${counts.e} evidence links`);

/* Mirror of recomputePatternStatuses() in src/lib/repo.ts so seeded patterns
   carry the same improving/resolved status the app would compute. */
{
  const pats = db.prepare(`SELECT * FROM patterns`).all();
  const upd = db.prepare(`UPDATE patterns SET status = ? WHERE id = ?`);
  for (const p of pats) {
    const since = db.prepare(
      `SELECT is_correct FROM attempts
        WHERE ${p.skill ? "skill = @key" : "domain = @key"}
          AND occurred_on >= @last
          AND id NOT IN (SELECT attempt_id FROM pattern_evidence WHERE pattern_id = @pid)
        ORDER BY occurred_on ASC, created_at ASC`,
    ).all({ key: p.skill ?? p.domain, last: p.last_seen, pid: p.id });

    let status = "active";
    if (since.length >= 2) {
      const rate = since.filter((a) => a.is_correct === 1).length / since.length;
      const lastThree = since.slice(-3);
      const allRecent = lastThree.length >= 3 && lastThree.every((a) => a.is_correct === 1);
      if (allRecent && rate >= 0.8) status = "resolved";
      else if (rate >= 0.6) status = "improving";
    }
    upd.run(status, p.id);
  }
  for (const p of db.prepare(`SELECT title, status FROM patterns`).all()) {
    console.log(`  ${p.status.padEnd(9)} ${p.title}`);
  }
}
