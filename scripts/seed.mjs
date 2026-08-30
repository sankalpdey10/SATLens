/**
 * Seeds SATLens with Sankalp's practice history.
 *
 *   npm run seed          (node scripts/seed.mjs --reset)
 *
 * 140 analyzed questions across five practice tests and two recent sessions.
 * All passages, questions and answer choices here are original writing.
 */
import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(process.env.SATLENS_DB_PATH ?? path.join(process.cwd(), "satlens.db"));
db.pragma("foreign_keys = ON");

// The app applies additive migrations on boot; this script talks to SQLite
// directly, so it must bring an older database up to date on its own.
for (const [table, column, ddl] of [
  ["patterns", "confidence", "ALTER TABLE patterns ADD COLUMN confidence REAL NOT NULL DEFAULT 0.7"],
]) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.length && !cols.some((c) => c.name === column)) db.exec(ddl);
}

if (process.argv.includes("--reset")) {
  db.exec(`DELETE FROM pattern_evidence; DELETE FROM patterns; DELETE FROM diagnoses;
           DELETE FROM attempts; DELETE FROM practice_items; DELETE FROM profile;`);
}

let seq = 0;
const nid = (p) => `${p}_${(++seq).toString(36).padStart(4, "0")}`;
const stamp = (d, i) => new Date(`${d}T09:00:00.000Z`).getTime() + i * 60000;
const iso = (d, i) => new Date(stamp(d, i)).toISOString();

const RW = "Reading and Writing", MA = "Math";
const D = {
  info: ["Information and Ideas", RW], craft: ["Craft and Structure", RW],
  expr: ["Expression of Ideas", RW], conv: ["Standard English Conventions", RW],
  alg: ["Algebra", MA], adv: ["Advanced Math", MA],
  psda: ["Problem-Solving and Data Analysis", MA], geo: ["Geometry and Trigonometry", MA],
};
const SKILL_DOMAIN = {
  "Inferences": D.info, "Central Ideas and Details": D.info, "Command of Evidence (Textual)": D.info,
  "Words in Context": D.craft, "Text Structure and Purpose": D.craft, "Cross-Text Connections": D.craft,
  "Transitions": D.expr, "Rhetorical Synthesis": D.expr,
  "Boundaries": D.conv, "Form, Structure, and Sense": D.conv,
  "Linear Equations in One Variable": D.alg, "Linear Functions": D.alg,
  "Linear Equations in Two Variables": D.alg, "Systems of Two Linear Equations": D.alg,
  "Linear Inequalities": D.alg,
  "Equivalent Expressions": D.adv, "Nonlinear Equations and Systems": D.adv, "Nonlinear Functions": D.adv,
  "Ratios, Rates, and Units": D.psda, "Percentages": D.psda, "Two-Variable Data and Models": D.psda,
  "Area and Volume": D.geo, "Lines, Angles, and Triangles": D.geo, "Right Triangles and Trigonometry": D.geo,
};

const C = (a, b, c, d) => JSON.stringify([
  { label: "A", text: a }, { label: "B", text: b },
  { label: "C", text: c }, { label: "D", text: d }]);

const insAttempt = db.prepare(`
  INSERT INTO attempts (id, created_at, occurred_on, source, source_label, section, domain, skill,
    difficulty, passage, question_text, choices, student_answer, correct_answer, is_correct,
    student_reasoning, time_spent_seconds, practice_item_id, retest_pattern_id, analyzed)
  VALUES (@id,@created_at,@occurred_on,@source,@source_label,@section,@domain,@skill,
    @difficulty,@passage,@question_text,@choices,@student_answer,@correct_answer,@is_correct,
    @student_reasoning,@time_spent_seconds,NULL,NULL,@analyzed)`);

const insDiag = db.prepare(`
  INSERT INTO diagnoses (id, attempt_id, created_at, mistake_type, headline, explanation,
    concept, faster_solution, trap, confidence)
  VALUES (@id,@attempt_id,@created_at,@mistake_type,@headline,@explanation,@concept,
    @faster_solution,@trap,@confidence)`);

let orderIdx = 0;
function add(a, dx) {
  const [domain, section] = SKILL_DOMAIN[a.skill];
  const id = nid("att");
  const correct = a.correct ?? false;
  insAttempt.run({
    id, created_at: iso(a.date, orderIdx++), occurred_on: a.date,
    source: a.source ?? "manual", source_label: a.label ?? null,
    section, domain, skill: a.skill, difficulty: a.difficulty ?? "medium",
    passage: a.passage ?? null, question_text: a.q,
    choices: a.choices ?? null,
    student_answer: a.you ?? (correct ? "B" : "A"),
    correct_answer: a.key ?? "B",
    is_correct: correct ? 1 : 0,
    student_reasoning: a.why ?? null,
    time_spent_seconds: a.t ?? null,
    analyzed: dx ? 1 : 0,
  });
  if (dx) insDiag.run({
    id: nid("dx"), attempt_id: id, created_at: iso(a.date, orderIdx),
    mistake_type: dx.type, headline: dx.headline, explanation: dx.explanation,
    concept: dx.concept, faster_solution: dx.faster ?? null, trap: dx.trap ?? null,
    confidence: dx.confidence ?? 0.85,
  });
  return id;
}

/* ==================================================================
   INFERENCE — 7 incorrect of 14. The primary pattern.
   5 chose a conclusion needing an unsupported assumption;
   2 chose a detail that did not directly support the conclusion.
   ================================================================== */

const OVER = {
  type: "incorrect_interpretation",
  concept:
    "An inference must be forced by the text, not merely compatible with it. If completing the sentence requires you to supply a fact the passage never states, that choice is wrong no matter how reasonable it sounds.",
  faster:
    "For each choice, ask 'what would have to also be true for this to work?' If the answer is anything the passage does not say, eliminate it.",
  confidence: 0.9,
};

const infA = add({
  date: "2026-07-18", label: "Practice Test 1", skill: "Inferences", t: 79, you: "C", key: "B",
  passage:
    "Ceramicists working in the Jomon tradition fired vessels in open pits rather than enclosed kilns. Open-pit firing produces uneven surface temperatures, and the resulting vessels vary noticeably in colour across a single piece. Archaeologists once read this variation as evidence of limited technical control. More recent analysis of pit residues shows that potters positioned fuel deliberately to concentrate heat on particular surfaces, which suggests that the colour variation was ______",
  q: "Which choice most logically completes the text?",
  choices: C(
    "the reason Jomon vessels were eventually replaced by kiln-fired ware.",
    "an intended effect rather than a limitation of the method.",
    "impossible to achieve using enclosed kilns of any design.",
    "the primary way archaeologists now date Jomon pottery."),
  why: "Open-pit firing sounds more primitive than kilns, so I figured the variation is why they switched to kilns eventually.",
}, { ...OVER,
  headline: "Completed the sentence with a conclusion the passage never sets up.",
  explanation:
    "Choice C requires that Jomon ware was replaced by kiln-fired pottery — the passage never mentions a replacement, a later period, or kilns being adopted. Your note shows you supplied that history yourself from background knowledge about kilns being 'more advanced.' The text only contrasts two readings of the colour variation, and the residue evidence points to B: it was deliberate.",
  trap: "C is historically plausible, which makes it feel safe even though nothing in the passage supports it.",
});

const infB = add({
  date: "2026-07-26", label: "Practice Test 2", skill: "Inferences", t: 88, you: "A", key: "D", difficulty: "hard",
  passage:
    "Botanist Elena Marchetti tracked flowering times for 40 alpine species over 18 years. Species that flower early in the season advanced their flowering by an average of 11 days over the study period. Late-flowering species showed almost no change. Marchetti notes that early-flowering species take their cue primarily from accumulated spring warmth, whereas late-flowering species respond mainly to day length. This difference implies that the two groups ______",
  q: "Which choice most logically completes the text?",
  choices: C(
    "were sampled at 40 separate alpine sites across the study period.",
    "will eventually flower at the same time each season.",
    "are equally vulnerable to changes in average temperature.",
    "will respond differently to further warming, since only one group's cue is temperature-based."),
  why: "The passage says 40 species over 18 years, so A is definitely accurate.",
}, {
  type: "distractor_selection",
  headline: "Chose an accurate detail that does not support the conclusion being drawn.",
  explanation:
    "A restates a fact from the first sentence, so it is true — but the sentence you are completing is about what the difference in cues *implies*. A says nothing about implication. The passage sets up a mechanism (warmth vs. day length) and the only choice that follows from it is D. You verified the choice against the text instead of against the logical slot it has to fill.",
  concept:
    "On inference questions the blank has a specific logical job. Check what the sentence is claiming — 'implies that', 'suggests that' — and require the choice to do that job, not merely be true.",
  faster: "Read the clause right before the blank. 'This difference implies that…' demands a consequence, which immediately eliminates any choice that is a restated fact.",
  trap: "A is copied almost verbatim from the passage, which reads as safe.",
  confidence: 0.86,
});

const infC = add({
  date: "2026-08-03", label: "Practice Test 3", skill: "Inferences", t: 86, you: "B", key: "C",
  passage:
    "A municipal program offered free transit passes to households that gave up a parking permit. Enrollment was high, and car ownership among enrolled households fell 22% over two years. Evaluators caution against reading this as proof that transit passes reduce car ownership, because households chose whether to enroll. Those who did may already have been planning to give up a car, which means the 22% figure ______",
  q: "Which choice most logically completes the text?",
  choices: C(
    "understates how effective the transit passes actually were.",
    "proves that free transit passes cause reductions in car ownership.",
    "may reflect who chose to enroll rather than the effect of the passes.",
    "would have been larger if the program had been mandatory."),
  why: "If people were already planning to drop a car, the program still helped them do it, so the real effect is probably even bigger than 22%.",
}, { ...OVER,
  headline: "Reasoned past the passage to a conclusion it explicitly warns against.",
  explanation:
    "Your reasoning added a premise the text never offers — that the passes 'still helped.' The passage is making the opposite move: it raises self-selection specifically to say the number may not measure the program's effect at all. C is the only choice that stays inside what the evaluators actually claim. This is the same habit as Practice Test 1: building a conclusion out of what seems sensible rather than what is written.",
  trap: "A rewards the instinct to defend the program, which the passage deliberately does not do.",
});

const infD = add({
  date: "2026-08-11", label: "Practice Test 4", skill: "Inferences", t: 82, you: "D", key: "A",
  passage:
    "Deep-sea anglerfish carry bioluminescent bacteria in a modified fin ray. The bacteria are not inherited; each fish acquires them from seawater. Yet the bacterial strains found in anglerfish are genetically distinct from free-living strains, and they lack several genes needed to survive outside a host. Researchers therefore conclude that these bacteria ______",
  q: "Which choice most logically completes the text?",
  choices: C(
    "cannot persist independently in seawater for long once specialized.",
    "are inherited from the parent fish in a small number of species.",
    "produce light through a mechanism unrelated to their host.",
    "are found in every species of deep-sea fish studied so far."),
  why: "The passage said the bacteria are found in anglerfish, so I picked the one about which fish have them.",
}, {
  type: "distractor_selection",
  headline: "Picked a choice about the topic instead of one the evidence forces.",
  explanation:
    "D is about distribution across species — the passage never surveys other species, so nothing supports it. The two pieces of evidence given (genetically distinct, missing survival genes) point in exactly one direction: these strains cannot make it on their own, which is A. You matched the choice to the subject matter rather than to the specific evidence in front of you.",
  concept:
    "Inference answers must be built from the specific facts supplied, not from the general topic. Ask which choice those two or three stated facts actually require.",
  faster: "Underline the evidence clauses ('genetically distinct', 'lack several genes'). The correct choice is the one both clauses point at.",
  trap: "D sounds like a reasonable biology statement, and it is on-topic.",
  confidence: 0.84,
});

/* ==================================================================
   WORDS IN CONTEXT — 5 incorrect of 10. Secondary pattern.
   Reaches for the most familiar sense of the word.
   ================================================================== */

const WIC = {
  type: "distractor_selection",
  concept:
    "Words in Context tests the sense the sentence needs, not the sense you know best. The most common meaning is almost always offered as a choice precisely because it is the first one that comes to mind.",
  faster:
    "Cover the choices, read the sentence, and say your own word out loud first. Then pick whichever choice is closest to it.",
  confidence: 0.87,
};

const wicA = add({
  date: "2026-07-26", label: "Practice Test 2", skill: "Words in Context", t: 74, you: "A", key: "C",
  passage:
    "The committee's report was careful not to qualify its central recommendation, stating the required reduction as a single figure with no accompanying conditions.",
  q: "As used in the text, what does the word \"qualify\" most nearly mean?",
  choices: C("Become eligible for", "Certify as competent", "Limit or moderate", "Describe in detail"),
  why: "Qualify means to meet requirements, like qualifying for a team.",
}, { ...WIC,
  headline: "Used the everyday sense of \"qualify\" rather than the sentence's sense.",
  explanation:
    "Your note gives the mechanism exactly: you reached for 'qualify' as in qualifying for a team. But the sentence says the report gave a single figure 'with no accompanying conditions' — so to qualify here is to attach conditions, i.e. to limit or moderate. The sentence supplies its own definition in the second half; the familiar meaning does not fit it.",
  trap: "A is the meaning almost every student meets first, so it is the default guess.",
});

const wicB = add({
  date: "2026-08-03", label: "Practice Test 3", skill: "Words in Context", t: 71, you: "B", key: "A",
  passage:
    "Rather than defending the original attribution, the curator allowed that the brushwork in the lower panel was inconsistent with the artist's documented technique.",
  q: "As used in the text, what does the word \"allowed\" most nearly mean?",
  choices: C("Conceded", "Permitted", "Enabled", "Tolerated"),
  why: "Allowed means gave permission — that's what the word means.",
}, { ...WIC,
  headline: "Defaulted to \"permitted\" and ignored the contrast the sentence sets up.",
  explanation:
    "'Rather than defending' tells you the curator gave ground. That makes 'allowed' mean conceded — admitted something against their own position. Permitted, enabled and tolerated all require someone to be granting permission, and there is nobody in the sentence being granted anything. The opening clause decides this question before the choices matter.",
  trap: "B, C and D are all shades of the common meaning, which makes the familiar sense feel triple-confirmed.",
});

const wicC = add({
  date: "2026-08-11", label: "Practice Test 4", skill: "Words in Context", t: 76, you: "D", key: "B", difficulty: "hard",
  passage:
    "The novel's structure is deceptively plain: chapters alternate between two narrators without commentary, and the reader is left to register the discrepancies between their accounts.",
  q: "As used in the text, what does the word \"register\" most nearly mean?",
  choices: C("Enroll formally", "Notice and take in", "Record in writing", "Express openly"),
  why: "Register means to write something down in a record, so C or D. I went with expressing it.",
}, { ...WIC,
  headline: "Chose a documentation sense where the sentence needs a perceptual one.",
  explanation:
    "The reader is 'left to register the discrepancies' — the text gives no commentary, so the work being described is happening in the reader's head, not on paper. That is noticing, B. Both C and D imply an external act the sentence never describes. As with the previous two, the familiar sense arrived first and the sentence's actual situation was not checked against it.",
  trap: "'Register' has a strong administrative association that pulls toward A and C.",
});

/* ==================================================================
   CENTRAL IDEAS — 3 incorrect of 8
   ================================================================== */

const CID = {
  type: "distractor_selection",
  concept:
    "A choice can be entirely true and still be wrong. Main idea asks which claim the other sentences exist to support.",
  faster: "Find the pivot ('Yet', 'But', 'However'); the thesis usually sits immediately after it.",
  confidence: 0.83,
};

const ciA = add({
  date: "2026-07-18", label: "Practice Test 1", skill: "Central Ideas and Details", t: 81, you: "A", key: "C",
  passage:
    "The Lisbon tram network runs 58 vehicles, some of them nearly a century old, and tourists queue for hours to ride the oldest line. The transit authority is unsentimental about them. Because the historic cars are narrow enough for streets laid out before motor traffic, they serve neighbourhoods that no modern vehicle can reach — which is the reason they remain in service at all.",
  q: "Which choice best states the main idea of the text?",
  choices: C(
    "The Lisbon tram network operates 58 vehicles, some almost a hundred years old.",
    "Tourists are willing to wait hours to ride Lisbon's oldest tram line.",
    "The historic trams survive because their size lets them serve otherwise unreachable streets.",
    "The transit authority does not regard the historic trams sentimentally."),
  why: "A is the clearest fact in the passage and it's definitely stated.",
}, { ...CID,
  headline: "Chose the opening fact over the claim the paragraph builds to.",
  explanation:
    "A is true and stated, and that is all it is. The passage tells you plainly why the trams remain in service — their width fits pre-motor streets — and every other sentence sets that up. Your note ('the clearest fact… definitely stated') describes testing for factual presence rather than for the role the sentence plays.",
  trap: "A is the first concrete detail in the text, so it anchors attention early.",
});

const ciB = add({
  date: "2026-08-11", label: "Practice Test 4", skill: "Central Ideas and Details", t: 77, you: "D", key: "B",
  passage:
    "Conservators at the Rijksmuseum photographed a single painting 12,000 times to build a composite image. The resulting file is enormous and is often cited as the highest-resolution photograph of an artwork ever made. The conservators are more interested in something else: at that resolution, the craquelure — the fine cracking in the paint — can be tracked over decades, turning the image into a baseline against which future deterioration can be measured.",
  q: "Which choice best states the main idea of the text?",
  choices: C(
    "The Rijksmuseum photographed one painting 12,000 times.",
    "The image's real value is as a baseline for tracking future deterioration.",
    "Craquelure is the fine cracking that develops in aging paint.",
    "The composite file is the highest-resolution photograph of an artwork ever made."),
  why: "The record-breaking resolution is the most impressive thing here and it's what the passage is known for.",
}, { ...CID,
  headline: "Took the most striking fact as the thesis instead of what the text says matters.",
  explanation:
    "The passage names the resolution record and then says outright that the conservators 'are more interested in something else.' That phrase is the pivot, and everything after it is the point: the image is a measurement baseline. Choosing D means stopping at the sentence the passage explicitly moves past.",
  trap: "D is the superlative claim, and superlatives read as important.",
});

/* ==================================================================
   MATH — Problem-Solving & Data Analysis, 4 incorrect of 10
   ================================================================== */

const RATIO = {
  type: "conceptual_misunderstanding",
  concept:
    "Write the relationship as a labelled equation before substituting numbers. Most ratio and rate errors are setup errors, not arithmetic errors.",
  confidence: 0.86,
};

const rtA = add({
  date: "2026-08-11", label: "Practice Test 4", skill: "Ratios, Rates, and Units", t: 79, you: "C", key: "B",
  q: "A machine fills 3 bottles every 8 seconds. At this rate, how many seconds are required to fill 54 bottles?",
  choices: C("128", "144", "162", "180"),
  why: "54 divided by 3 is 18, then I multiplied by 9 instead of 8 somewhere. I set it up as 54 × 3 ÷ 8 at first.",
}, { ...RATIO,
  headline: "Inverted the rate when setting up the proportion.",
  explanation:
    "The rate is 8 seconds per 3 bottles, so seconds = 54 × (8/3) = 144. Your first setup, 54 × 3 ÷ 8, multiplies by bottles-per-second instead of dividing — the units come out as bottles²/second rather than seconds. The arithmetic afterwards cannot rescue a setup whose units are wrong.",
  faster: "Check units before computing: you want an answer in seconds, so the ratio you multiply by must have seconds on top.",
});

const pcA = add({
  date: "2026-08-03", label: "Practice Test 3", skill: "Percentages", t: 74, you: "A", key: "C",
  q: "A population increases by 25% in the first year and decreases by 20% in the second. Over the two years, the population has changed by what percent?",
  choices: C("+5%", "-5%", "0%", "+45%"),
  why: "25 up and 20 down nets out to 5% up.",
}, {
  type: "conceptual_misunderstanding",
  headline: "Added percent changes instead of multiplying the factors.",
  explanation:
    "Successive percent changes multiply: 1.25 × 0.80 = 1.00, so the population is exactly back where it started. Adding +25 and −20 to get +5 treats both percentages as applying to the same base, but the 20% decrease applies to the already-increased population.",
  concept: "Convert every percent change to a multiplier and chain them. Percentages of different bases are never additive.",
  faster: "Start from 100: 100 → 125 → 100. No algebra needed.",
  trap: "A is precisely the answer additive reasoning produces.",
  confidence: 0.91,
});

const tvA = add({
  date: "2026-08-19", label: "Practice Test 5", skill: "Two-Variable Data and Models", t: 81, you: "B", key: "D",
  q: "A scatterplot of study hours (x) against test score (y) has a line of best fit with equation y = 8x + 62. What does the number 8 represent?",
  choices: C(
    "The score of a student who studies zero hours.",
    "The total increase in score across the whole study.",
    "The number of students in the sample.",
    "The predicted score increase for each additional hour studied."),
  why: "8 is the slope so it's the total change in score across the data.",
}, {
  type: "incorrect_interpretation",
  headline: "Read the slope as a total rather than a per-unit rate.",
  explanation:
    "You correctly identified 8 as the slope, then described it as a total change. Slope is always a rate: score per additional hour. The total change depends on how wide the x-range is, which the question never gives.",
  concept: "In y = mx + b, m is a per-one-unit rate and b is the value at x = 0. State both in the units of the problem before answering.",
  confidence: 0.88,
});

/* ==================================================================
   Remaining Reading & Writing and Math misses
   ================================================================== */

add({ date: "2026-07-26", label: "Practice Test 2", skill: "Command of Evidence (Textual)", t: 79, you: "A", key: "C",
  q: "Which quotation from the field notes most directly supports the claim that the colony relocated in response to temperature rather than food supply?",
  choices: C("\"Krill density in the original bay was unchanged all season.\"", "\"The new site lies 40 km north of the old one.\"",
    "\"Water temperature rose 2.1°C over six weeks; the move began in week five.\"", "\"This species has relocated in three of the past ten seasons.\""),
  why: "A rules out food supply, which is the other half of the claim.",
}, { type: "strategy_issue",
  headline: "Supported the claim by eliminating the alternative rather than establishing the mechanism.",
  explanation: "A weakens the food-supply explanation but says nothing about temperature. C establishes both the temperature change and its timing relative to the move, which is what the claim actually asserts.",
  concept: "For an 'X rather than Y' claim, prefer evidence that positively establishes X. Ruling out Y leaves the claim itself unsupported.",
  confidence: 0.82 });

add({ date: "2026-08-19", label: "Practice Test 5", skill: "Command of Evidence (Textual)", t: 74, you: "D", key: "B",
  q: "Which finding, if true, would most strongly support the researcher's hypothesis that the glaze was applied after firing?",
  choices: C("The vessel's clay body contains iron oxide.", "The glaze layer shows no thermal cracking consistent with kiln temperatures.",
    "Similar vessels have been found at three nearby sites.", "The workshop operated for at least two centuries."),
  why: "The workshop lasting two centuries means they had time to develop the technique.",
}, { type: "incorrect_interpretation",
  headline: "Chose background context over evidence bearing on the hypothesis.",
  explanation: "Duration of the workshop is compatible with any glazing method. B is the only choice that speaks to whether the glaze experienced kiln heat, which is exactly what 'applied after firing' predicts.",
  concept: "Ask what the hypothesis predicts you would observe. The right evidence is the observation that would differ if the hypothesis were false.",
  confidence: 0.8 });

add({ date: "2026-08-03", label: "Practice Test 3", skill: "Text Structure and Purpose", t: 72, you: "B", key: "A",
  q: "Which choice best describes the function of the underlined sentence in the text as a whole?",
  choices: C("It introduces an objection the rest of the paragraph answers.", "It summarizes the paragraph's conclusion.",
    "It provides a statistic supporting the opening claim.", "It shifts the discussion to an unrelated topic."),
  why: "It felt like a summary of what came before.",
}, { type: "misreading", headline: "Read a setup sentence as a summary.",
  explanation: "The sentence appears before the paragraph's reasoning, not after it, and the following sentences respond to it directly. That is an objection being raised to be answered.",
  concept: "Function questions are decided by position and by what the surrounding sentences do with the sentence, not by its tone.", confidence: 0.78 });

add({ date: "2026-08-19", label: "Practice Test 5", skill: "Text Structure and Purpose", t: 68, you: "C", key: "D",
  q: "Which choice best states the overall structure of the text?",
  choices: C("A chronological account of a discovery.", "A comparison of two competing measurement techniques.",
    "A list of applications for a new material.", "A widely held view, followed by evidence complicating it."),
  why: "There were several examples so I thought it was a list.",
}, { type: "misreading", headline: "Mistook supporting examples for the organizing structure.",
  explanation: "The examples all serve one move: complicating a stated assumption. Counting examples describes the surface, not the structure.",
  concept: "Structure questions ask what the paragraph DOES, not what it contains.", confidence: 0.76 });

add({ date: "2026-07-26", label: "Practice Test 2", skill: "Cross-Text Connections", t: 88, you: "A", key: "C",
  q: "Based on the texts, how would the author of Text 2 most likely respond to the claim in Text 1?",
  choices: C("By agreeing and adding a further example.", "By dismissing the claim as irrelevant.",
    "By accepting the observation but disputing the explanation offered for it.", "By questioning whether the data were collected correctly."),
  why: "Both texts talked about the same phenomenon so I assumed they agreed.",
}, { type: "incorrect_interpretation", headline: "Treated shared subject matter as agreement.",
  explanation: "Text 2 accepts the same observation but attributes it to a different cause. Two authors discussing one phenomenon frequently disagree about mechanism while agreeing on the facts.",
  concept: "Separate what each author OBSERVES from what each author CLAIMS causes it. Cross-text questions usually turn on the second.", confidence: 0.84 });

add({ date: "2026-08-11", label: "Practice Test 4", skill: "Cross-Text Connections", t: 85, you: "D", key: "B",
  q: "Which choice best describes a difference in how the two texts present the 1908 survey?",
  choices: C("Text 1 dates it earlier than Text 2 does.", "Text 1 treats it as settled evidence; Text 2 treats it as provisional.",
    "Text 1 omits it entirely.", "Text 2 disputes who conducted it."),
  why: "Text 2 said 'reportedly' so I thought it was disputing the authorship.",
}, { type: "misreading", headline: "Attached a hedging word to the wrong claim.",
  explanation: "'Reportedly' hedges the survey's findings, not who carried it out. The contrast the texts actually draw is settled versus provisional.",
  concept: "When a text hedges, identify precisely which clause the hedge governs before drawing a contrast from it.", confidence: 0.79 });

add({ date: "2026-08-03", label: "Practice Test 3", skill: "Transitions", t: 55, you: "A", key: "C",
  q: "Which choice completes the text with the most logical transition?",
  passage: "The alloy resists corrosion better than steel and costs less at scale. ______ its brittleness below freezing has kept it out of aerospace use.",
  choices: C("Therefore,", "Similarly,", "Nevertheless,", "For instance,"),
  why: "The first sentence lists good properties so the second seemed like the result.",
}, { type: "incorrect_interpretation", headline: "Read a contrast as a consequence.",
  explanation: "The first sentence lists advantages; the second names a drawback that blocks a use case. That is opposition, not result.",
  concept: "Read the sentence after the blank before choosing. Only the second sentence tells you the direction.",
  faster: "Decide 'same direction or opposite' in your own words first — that kills half the choices.", confidence: 0.85 });

add({ date: "2026-08-19", label: "Practice Test 5", skill: "Rhetorical Synthesis", t: 76, you: "B", key: "D",
  q: "The student wants to emphasize the difference in scale between the two projects. Which choice best accomplishes this goal?",
  choices: C("Both projects were completed by municipal crews.", "The first project began in 1994 and the second in 2011.",
    "Both projects required environmental review.", "The first covered 3 hectares; the second covered 290."),
  why: "The dates show they were different projects at different times.",
}, { type: "strategy_issue", headline: "Answered a different goal than the one stated.",
  explanation: "The stated goal is scale. Dates establish sequence, not size. D is the only choice that puts two magnitudes side by side.",
  concept: "Underline the goal in the prompt and check each choice against that goal alone. Accurate notes that serve a different goal are the standard distractor.", confidence: 0.88 });

add({ date: "2026-07-18", label: "Practice Test 1", skill: "Boundaries", t: 48, you: "C", key: "A",
  q: "Which choice conforms to the conventions of Standard English?",
  passage: "The survey covered four provinces ______ two of which had never been mapped at that resolution.",
  choices: C("provinces,", "provinces;", "provinces:", "provinces"),
  why: "It felt like a list was coming so I used a colon.",
}, { type: "conceptual_misunderstanding", headline: "Used a colon before a dependent clause.",
  explanation: "'two of which had never been mapped' is a dependent clause, not an independent one and not a list. A comma is the correct boundary; a colon requires a complete idea before it.",
  concept: "Test both sides of the punctuation for independence first. That one check resolves most boundary questions.", confidence: 0.89 });

add({ date: "2026-07-26", label: "Practice Test 2", skill: "Form, Structure, and Sense", t: 52, you: "B", key: "A",
  q: "Which choice conforms to the conventions of Standard English?",
  passage: "The collection of manuscripts, along with several early maps, ______ housed in the east reading room.",
  choices: C("is", "are", "were", "have been"),
  why: "Manuscripts and maps are plural so I used 'are'.",
}, { type: "conceptual_misunderstanding", headline: "Agreed the verb with the interrupting phrase, not the subject.",
  explanation: "The subject is 'The collection', which is singular. 'along with several early maps' is a supplement set off by commas and never changes the number of the subject.",
  concept: "Cross out anything between commas, then match the verb to what remains.", confidence: 0.9 });

add({ date: "2026-08-11", label: "Practice Test 4", skill: "Form, Structure, and Sense", t: 58, you: "D", key: "B",
  q: "Which choice conforms to the conventions of Standard English?",
  passage: "Having reviewed the sediment cores, ______ concluded that the lake had drained abruptly.",
  choices: C("the conclusion was that the team", "the team", "it was", "the abrupt drainage suggested that the team"),
  why: "I picked the one that mentioned the drainage since that's the finding.",
}, { type: "conceptual_misunderstanding", headline: "Left the opening modifier attached to the wrong noun.",
  explanation: "'Having reviewed the sediment cores' must describe whoever did the reviewing. Only 'the team' can follow it; every other choice makes a conclusion or the drainage do the reviewing.",
  concept: "An opening participial phrase attaches to the very next noun. Name the actor first.", confidence: 0.87 });

add({ date: "2026-08-03", label: "Practice Test 3", skill: "Linear Inequalities", t: 71, you: "C", key: "A",
  q: "If -3x + 7 > 19, which of the following describes all possible values of x?",
  choices: C("x < -4", "x > -4", "x < 4", "x > 4"),
  why: "I got to -3x > 12 then divided by -3 and wrote x > -4.",
}, { type: "conceptual_misunderstanding", headline: "Did not flip the inequality when dividing by a negative.",
  explanation: "From -3x > 12, dividing both sides by -3 reverses the inequality: x < -4. Your algebra was correct up to that step; the direction was not.",
  concept: "Multiplying or dividing an inequality by a negative number reverses the sign. Mark the step before you do it.",
  faster: "Test x = -5: -3(-5)+7 = 22 > 19 ✓. Testing one value confirms the direction instantly.", confidence: 0.92 });

add({ date: "2026-08-19", label: "Practice Test 5", skill: "Nonlinear Equations and Systems", t: 88, you: "C", key: "B",
  q: "If √(2x + 15) = x, what is the value of x?",
  choices: C("-3", "5", "-3 and 5", "No solution"),
  why: "Squared both sides and factored to get x = -3 and x = 5, so I picked both.",
}, { type: "conceptual_misunderstanding", headline: "Kept a root that fails the original equation.",
  explanation: "Squaring can introduce solutions the original never had. x = -3 gives √9 = 3, and 3 ≠ -3, so it is extraneous. Only x = 5 survives.",
  concept: "Every solution to a radical equation must be substituted back into the ORIGINAL equation before it counts.",
  faster: "A square root is never negative, so x ≥ 0 before you factor. That eliminates -3 and choices A and C immediately.",
  trap: "C is built for exactly this error — it offers both algebraic roots.", confidence: 0.93 });

/* ==================================================================
   RECENT SESSIONS — the 12 most recent attempts
   ================================================================== */

// These two sessions are targeted drills on Sankalp's weak skills, not full
// tests, so their accuracy is expected to sit below his test average.
const S1 = "2026-08-27", S2 = "2026-08-28", SESS = "Weak-skill review";

const infR1 = add({
  date: S1, label: SESS, skill: "Inferences", t: 84, you: "D", key: "A",
  passage:
    "Urban beekeepers report higher winter survival rates than rural beekeepers in the same region. Rural colonies are more often sited near monoculture crops, which bloom heavily but briefly. City colonies draw instead on gardens and street plantings that flower in overlapping succession across the season. This suggests that winter survival depends less on total forage volume than on ______",
  q: "Which choice most logically completes the text?",
  choices: C(
    "how evenly forage is distributed across the season.",
    "the number of colonies a beekeeper maintains at one site.",
    "whether beekeepers provide supplemental feeding in autumn.",
    "the average winter temperature in urban areas."),
  why: "Cities are warmer than the countryside, so that's probably why the urban hives survive better.",
}, { ...OVER,
  headline: "Supplied an explanation from outside the passage instead of the one it sets up.",
  explanation:
    "Urban heat islands are real, but the passage never mentions temperature — you brought that in yourself. The text contrasts brief monoculture blooms against staggered garden blooms, and the sentence explicitly discounts 'total forage volume,' which leaves distribution across the season. A is the only choice the evidence reaches.",
  trap: "D is true of cities in general, which makes it feel like knowledge rather than assumption.",
});

const wicR2 = add({
  date: S1, label: SESS, skill: "Words in Context", t: 72, you: "C", key: "A",
  passage:
    "The proposal was novel enough that the review board declined to entertain it at the first sitting, deferring discussion until members had time to consult outside specialists.",
  q: "As used in the text, what does the word \"entertain\" most nearly mean?",
  choices: C("Consider", "Amuse", "Host as a guest", "Maintain in good repair"),
  why: "Entertain means to amuse people, like entertainment.",
}, { ...WIC,
  headline: "Took the most familiar sense of \"entertain\" over the one the sentence requires.",
  explanation:
    "A review board deferring discussion is deciding whether to take something up — that is 'consider.' Your note names the mechanism directly: you went to 'entertainment' first. The sentence gives you 'deferring discussion' as a paraphrase two clauses later, which points straight at A.",
  trap: "B is the everyday meaning and it arrives before you finish reading the sentence.",
});

const infR3 = add({
  date: S1, label: SESS, skill: "Inferences", t: 91, you: "B", key: "C", difficulty: "hard",
  passage:
    "A publisher tested two cover designs for the same novel across matched bookstores. Copies with the second cover sold 30% better. The publisher concluded that the second design was more appealing. A researcher points out that the second cover was also used in the edition stocked at eye level in most of the test stores, meaning the sales difference ______",
  q: "Which choice most logically completes the text?",
  choices: C(
    "proves that shelf position matters more than cover design.",
    "would have been larger if both covers had been placed at eye level.",
    "cannot be attributed to the cover design alone.",
    "shows the first cover was poorly designed."),
  why: "If the good cover was at eye level and still only got 30%, the design effect must be even stronger than it looks.",
}, { ...OVER,
  headline: "Built a conclusion on an assumption the passage does not license.",
  explanation:
    "Your reasoning assumes eye-level placement was working against the design effect, which is backwards and, more importantly, is not in the text. The researcher's point is narrower: two variables changed together, so the 30% cannot be assigned to either one. C is the only choice that stops where the evidence stops. This is the third time this month the answer required an assumption the passage never supplied.",
  trap: "B rewards the instinct to quantify the effect rather than question whether it can be isolated.",
});

add({ date: S1, label: SESS, skill: "Transitions", t: 43, correct: true, you: "C", key: "C",
  q: "Which choice completes the text with the most logical transition?",
  passage: "Early prototypes failed within days of continuous use. ______ the current model has run for eight months without servicing.",
  choices: C("Consequently,", "In addition,", "By contrast,", "For example,") });

add({ date: S1, label: SESS, skill: "Linear Equations in One Variable", t: 49, correct: true, you: "B", key: "B",
  q: "If 5(x - 3) + 4 = 2x + 10, what is the value of x?",
  choices: C("5", "7", "9", "11") });

const ciR6 = add({
  date: S1, label: SESS, skill: "Central Ideas and Details", t: 78, you: "A", key: "D",
  passage:
    "The Svalbard seed vault holds more than a million samples and is routinely described as insurance against global catastrophe. The agronomists who deposit there describe its function more modestly. Because national seed banks are vulnerable to power failures, funding lapses and conflict, the vault's real work is absorbing ordinary institutional failure — the kind that happens somewhere every year.",
  q: "Which choice best states the main idea of the text?",
  choices: C(
    "The Svalbard seed vault holds over a million seed samples.",
    "National seed banks are vulnerable to power failures and conflict.",
    "The vault is commonly described as insurance against global catastrophe.",
    "The vault's real function is absorbing routine institutional failures, not rare catastrophes."),
  why: "The million samples is the headline fact about the vault.",
}, { ...CID,
  headline: "Chose the headline statistic over the claim the passage argues for.",
  explanation:
    "The passage names the catastrophe framing, says the people who use it describe the function 'more modestly,' and then gives that modest description. D is where the paragraph lands. A is the opening fact, and your note ('the headline fact') shows you selected on prominence rather than on argumentative role.",
});

add({ date: S2, label: SESS, skill: "Boundaries", t: 37, correct: true, you: "B", key: "B",
  q: "Which choice conforms to the conventions of Standard English?",
  passage: "The archive holds letters from three cartographers ______ each of whom mapped a different stretch of coast.",
  choices: C("cartographers;", "cartographers,", "cartographers:", "cartographers") });

const rtR8 = add({
  date: S2, label: SESS, skill: "Ratios, Rates, and Units", t: 82, you: "D", key: "B",
  q: "A recipe calls for flour and water in a 5:2 ratio by weight. If a baker uses 640 grams of flour, how many grams of water are required?",
  choices: C("128", "256", "320", "1600"),
  why: "5:2 so I multiplied 640 by 2.5 to scale it up.",
}, { ...RATIO,
  headline: "Scaled in the wrong direction on the ratio.",
  explanation:
    "Flour to water is 5:2, so water = flour × (2/5) = 640 × 0.4 = 256. Multiplying by 2.5 applies the ratio the other way round and produces more water than flour, which contradicts the 5:2 relationship you were given. Same mechanism as the bottle-filling question on Practice Test 4: the arithmetic was fine, the setup was inverted.",
  faster: "Sanity-check the direction first: flour outnumbers water 5 to 2, so the water figure must be smaller than 640. That rules out D immediately.",
});

const infR9 = add({
  date: S2, label: SESS, skill: "Inferences", t: 87, you: "A", key: "D",
  passage:
    "Medieval scribes occasionally left blank spaces in manuscripts where a decorated initial was to be added later by a specialist. In several surviving volumes the spaces were never filled. Historians once treated these gaps as evidence that the workshops were disrupted mid-project. But the same volumes show completed rubrication in later sections, work that was normally done after initials, which indicates the gaps ______",
  q: "Which choice most logically completes the text?",
  choices: C(
    "prove that the workshops closed before the manuscripts were finished.",
    "were left by scribes who could not afford specialist decorators.",
    "were intended to be filled by the manuscripts' eventual owners.",
    "were not simply the result of work stopping partway through."),
  why: "Blank spaces mean unfinished work, so the workshop must have shut down before they could finish.",
}, { ...OVER,
  headline: "Kept the explanation the passage is in the middle of dismantling.",
  explanation:
    "The word 'But' tells you the historians' disruption theory is about to be complicated, and the evidence given — later-stage rubrication completed — shows work continued past the point where the initials should have been added. A restates the very view being overturned. Your note reaches for the intuitive reading of a blank space rather than following what the rubrication evidence forces, which is D.",
  trap: "A is the reading the passage itself introduces first, so it feels endorsed.",
});

add({ date: S2, label: SESS, skill: "Command of Evidence (Textual)", t: 61, correct: true, you: "C", key: "C",
  q: "Which quotation most directly supports the claim that the technique spread by apprenticeship rather than written instruction?",
  choices: C("\"The workshop produced over 400 pieces.\"", "\"No manuals describing the technique survive.\"",
    "\"Every practitioner identified trained under a master who used the method.\"", "\"The technique required specialized kilns.\"") });

const wicR11 = add({
  date: S2, label: SESS, skill: "Words in Context", t: 69, you: "B", key: "D",
  passage:
    "Although the initial findings were striking, the author is careful to temper her claims, noting repeatedly that the sample was small and drawn from a single region.",
  q: "As used in the text, what does the word \"temper\" most nearly mean?",
  choices: C("Harden by heating", "Lose one's composure", "Blend thoroughly", "Moderate"),
  why: "Temper is about heating metal, or losing your temper — I went with the temper you lose.",
}, { ...WIC,
  headline: "Reached for two familiar senses of \"temper\" and neither fits the sentence.",
  explanation:
    "An author noting the limits of her own sample is qualifying her claims — moderating them. Both meanings you weighed require a person losing control or metal being treated, and the sentence contains neither. The clue is 'Although the initial findings were striking': the sentence is built as a concession, and only D completes that contrast. This is the fifth Words in Context miss with the same shape.",
  trap: "'Lose one's temper' is the highest-frequency use of the word in speech.",
});

add({ date: S2, label: SESS, skill: "Nonlinear Functions", t: 55, correct: true, you: "C", key: "C",
  q: "The function f(x) = 2(3)^x models a population. What does the 3 represent?",
  choices: C("The starting population", "The population after one period", "The factor by which the population multiplies each period", "The total growth over the period") });

/* ==================================================================
   FILLER — correct answers that bring each skill to its exact total
   ================================================================== */

const TARGETS = {
  "Inferences": [14, 7], "Central Ideas and Details": [8, 5], "Command of Evidence (Textual)": [8, 6],
  "Words in Context": [10, 5], "Text Structure and Purpose": [8, 6], "Cross-Text Connections": [6, 4],
  "Transitions": [12, 11], "Rhetorical Synthesis": [8, 7],
  "Boundaries": [12, 11], "Form, Structure, and Sense": [10, 8],
  "Linear Equations in One Variable": [5, 5], "Linear Functions": [4, 4],
  "Linear Equations in Two Variables": [3, 3], "Systems of Two Linear Equations": [2, 2],
  "Linear Inequalities": [2, 1],
  "Equivalent Expressions": [4, 4], "Nonlinear Equations and Systems": [4, 3], "Nonlinear Functions": [4, 4],
  "Ratios, Rates, and Units": [4, 2], "Percentages": [3, 2], "Two-Variable Data and Models": [3, 2],
  "Area and Volume": [2, 2], "Lines, Angles, and Triangles": [2, 2], "Right Triangles and Trigonometry": [2, 2],
};

const STEMS = {
  "Inferences": "Which choice most logically completes the text?",
  "Central Ideas and Details": "Which choice best states the main idea of the text?",
  "Command of Evidence (Textual)": "Which quotation from the text most directly supports the claim?",
  "Words in Context": "As used in the text, what does the underlined word most nearly mean?",
  "Text Structure and Purpose": "Which choice best describes the function of the underlined sentence?",
  "Cross-Text Connections": "Based on the texts, how would the author of Text 2 respond to Text 1?",
  "Transitions": "Which choice completes the text with the most logical transition?",
  "Rhetorical Synthesis": "Which choice most effectively accomplishes the student's stated goal?",
  "Boundaries": "Which choice conforms to the conventions of Standard English?",
  "Form, Structure, and Sense": "Which choice conforms to the conventions of Standard English?",
  "Linear Equations in One Variable": "Solve the linear equation for x.",
  "Linear Functions": "What does the slope of the function represent in this context?",
  "Linear Equations in Two Variables": "Which equation represents the line described?",
  "Systems of Two Linear Equations": "What is the solution to the system of equations?",
  "Linear Inequalities": "Which inequality describes all possible values of x?",
  "Equivalent Expressions": "Which expression is equivalent to the given expression?",
  "Nonlinear Equations and Systems": "What is the solution to the given equation?",
  "Nonlinear Functions": "What does the given parameter represent in the model?",
  "Ratios, Rates, and Units": "Using the given rate, determine the required quantity.",
  "Percentages": "Determine the percent change described.",
  "Two-Variable Data and Models": "Interpret the line of best fit in context.",
  "Area and Volume": "Determine the volume of the described solid.",
  "Lines, Angles, and Triangles": "Determine the measure of the indicated angle.",
  "Right Triangles and Trigonometry": "Determine the length of the indicated side.",
};

const TESTS = [
  ["2026-07-18", "Practice Test 1"], ["2026-07-26", "Practice Test 2"],
  ["2026-08-03", "Practice Test 3"], ["2026-08-11", "Practice Test 4"],
  ["2026-08-19", "Practice Test 5"],
];

// Correct answers run faster than misses; these keep the overall mean near 69s.
const FILLER_TIMES = [63, 69, 76, 57, 71, 66, 80, 60, 74, 68, 53, 77];

let fillerIdx = 0;
for (const [skill, [wantTotal, wantCorrect]] of Object.entries(TARGETS)) {
  const cur = db.prepare(
    `SELECT COUNT(*) total, COALESCE(SUM(is_correct),0) correct FROM attempts WHERE skill = ?`,
  ).get(skill);

  const needCorrect = wantCorrect - cur.correct;
  const needIncorrect = (wantTotal - wantCorrect) - (cur.total - cur.correct);

  if (needIncorrect !== 0) {
    console.error(`  ! ${skill}: incorrect count off by ${needIncorrect}`);
  }

  for (let i = 0; i < needCorrect; i++) {
    const [date, label] = TESTS[fillerIdx % TESTS.length];
    add({
      date, label, skill,
      t: FILLER_TIMES[fillerIdx % FILLER_TIMES.length],
      correct: true, you: "B", key: "B",
      difficulty: i % 3 === 0 ? "easy" : i % 3 === 1 ? "medium" : "hard",
      q: STEMS[skill],
    });
    fillerIdx++;
  }
}

/* ==================================================================
   PATTERNS
   ================================================================== */

const insPattern = db.prepare(`
  INSERT INTO patterns (id, created_at, updated_at, title, description, recommendation,
    section, domain, skill, mistake_type, severity, confidence, status, first_seen, last_seen)
  VALUES (@id,@created_at,@updated_at,@title,@description,@recommendation,@section,@domain,
    @skill,@mistake_type,@severity,@confidence,'active',@first_seen,@last_seen)`);
const insEvidence = db.prepare(
  `INSERT OR IGNORE INTO pattern_evidence (pattern_id, attempt_id, note) VALUES (?,?,?)`);

function pattern(p, evidence) {
  const id = nid("pat");
  insPattern.run({ ...p, id, created_at: iso(p.last_seen, 0), updated_at: iso(p.last_seen, 0) });
  for (const [attemptId, note] of evidence) insEvidence.run(id, attemptId, note);
}

pattern({
  title: "Draws inferences that go beyond what the passage supports",
  description:
    "Across 14 inference questions you answered 7 correctly. Of the 7 misses, 5 selected a conclusion that was plausible but required an assumption the passage never supplies, and 2 selected a detail that was accurate but did not support the conclusion being drawn. Your own notes name the mechanism repeatedly -- 'cities are warmer', 'the workshop must have shut down', 'the real effect is probably even bigger'. The problem is not that inference is unclear to you; it is that you keep completing the argument with outside knowledge instead of stopping where the evidence stops.",
  recommendation:
    "For every choice, ask: what would ALSO have to be true for this to work? If that extra fact is not in the passage, eliminate the choice -- however reasonable it sounds. Inference answers should feel almost too cautious.",
  section: RW, domain: "Information and Ideas", skill: "Inferences",
  mistake_type: "incorrect_interpretation", severity: "high", confidence: 0.92,
  first_seen: "2026-07-18", last_seen: "2026-08-28",
}, [
  [infA, "Supplied a kiln-replacement history the passage never mentions."],
  [infB, "Chose an accurate sampling detail where the sentence required a consequence."],
  [infC, "Argued the effect was 'even bigger' — the passage warns the number may measure nothing."],
  [infD, "Selected an on-topic claim about other species that no stated evidence supports."],
  [infR1, "Explained urban hive survival with temperature, which the passage never raises."],
  [infR3, "Assumed shelf position worked against the cover design; not in the text."],
  [infR9, "Kept the disruption theory the passage uses 'But' to overturn."],
]);

pattern({
  title: "Selects the familiar definition instead of the contextual meaning",
  description:
    "Words in Context is your weakest Craft and Structure skill at 50% across 10 questions. In all 5 misses you chose the word's most common everyday sense — 'qualify' as in qualifying for a team, 'entertain' as in entertainment, 'temper' as in losing one's temper — rather than testing which meaning the sentence actually needs. In four of the five, the sentence contained a clue clause ('with no accompanying conditions', 'deferring discussion', 'Although the initial findings were striking') that settles the question on its own.",
  recommendation:
    "Cover the answer choices. Read the sentence and say your own replacement word aloud, then pick the choice closest to it. Never let the first definition you recall be the one you check first.",
  section: RW, domain: "Craft and Structure", skill: "Words in Context",
  mistake_type: "distractor_selection", severity: "moderate", confidence: 0.72,
  first_seen: "2026-07-26", last_seen: "2026-08-28",
}, [
  [wicA, "Read 'qualify' as meeting requirements rather than limiting a claim."],
  [wicB, "Defaulted to 'permitted' despite the concessive 'Rather than defending'."],
  [wicC, "Chose a documentation sense of 'register' where perception was required."],
  [wicR2, "Went to 'entertainment' first; the sentence paraphrases the answer as 'deferring discussion'."],
  [wicR11, "Weighed two literal senses of 'temper' and neither fits a concessive sentence."],
]);

pattern({
  title: "Sets up the relationship incorrectly on ratio and rate problems",
  description:
    "Problem-Solving and Data Analysis is your only weak Math domain at 60%, and it is concentrated in setup rather than computation. On both ratio questions you inverted the relationship before doing any arithmetic, and the percent-change question was answered by adding percentages that apply to different bases. In every case the individual calculation was performed correctly on a relationship that was already wrong.",
  recommendation:
    "Before substituting numbers, write the relationship with units attached and sanity-check the direction: should the answer be larger or smaller than the number you were given? On percent problems, convert each change to a multiplier and chain them.",
  section: MA, domain: "Problem-Solving and Data Analysis", skill: null,
  mistake_type: "conceptual_misunderstanding", severity: "moderate", confidence: 0.68,
  first_seen: "2026-08-03", last_seen: "2026-08-28",
}, [
  [rtA, "Multiplied by bottles-per-second instead of seconds-per-bottle."],
  [rtR8, "Scaled 640 g up by 2.5 when water must be smaller than flour at 5:2."],
  [pcA, "Added +25% and -20% as if both applied to the same base."],
  [tvA, "Read the slope as a total change rather than a per-hour rate."],
]);

/* ================================ profile ================================ */

db.prepare(
  `INSERT INTO profile (id, test_date, target_score, current_score, hours_per_week, updated_at)
   VALUES (1, '2026-11-07', 1500, 1360, 8, ?)
   ON CONFLICT(id) DO UPDATE SET test_date=excluded.test_date, target_score=excluded.target_score,
     current_score=excluded.current_score, hours_per_week=excluded.hours_per_week`,
).run(iso("2026-08-28", 0));

/* ============================ status + report ============================ */

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
      const last3 = since.slice(-3);
      if (last3.length >= 3 && last3.every((a) => a.is_correct === 1) && rate >= 0.8) status = "resolved";
      else if (rate >= 0.6) status = "improving";
    }
    upd.run(status, p.id);
  }
}

const o = db.prepare(
  `SELECT COUNT(*) total, SUM(is_correct) correct, ROUND(AVG(time_spent_seconds),1) avgt,
          (SELECT COUNT(*) FROM diagnoses) dx, (SELECT COUNT(*) FROM patterns) pats
     FROM attempts`).get();
console.log(`\nSankalp — ${o.total} questions, ${o.correct} correct (${Math.round(o.correct/o.total*100)}%), avg ${o.avgt}s`);
console.log(`${o.dx} diagnosed mistakes · ${o.pats} patterns\n`);
for (const d of db.prepare(
  `SELECT domain, COUNT(*) n, SUM(is_correct) c FROM attempts GROUP BY domain
    ORDER BY (CAST(SUM(is_correct) AS REAL)/COUNT(*)) ASC`).all())
  console.log(`  ${String(Math.round(d.c/d.n*100)+"%").padStart(4)}  ${d.domain}  (${d.c}/${d.n})`);
console.log();
for (const p of db.prepare(`SELECT title,status,severity,confidence FROM patterns`).all())
  console.log(`  [${p.status}/${p.severity}/conf ${p.confidence}] ${p.title}`);
