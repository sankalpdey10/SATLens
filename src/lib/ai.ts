import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

/**
 * Thin wrapper over the Claude API. Every AI feature in SATLens returns
 * structured JSON validated against a Zod schema, so the rest of the app never
 * has to parse free-form model text.
 */

export const MODEL = "claude-opus-5";

/**
 * Demo mode runs the whole product with zero API calls: every model-backed
 * feature falls back to a deterministic local implementation. Intended for
 * live demos and offline development, not as a substitute for the real
 * analysis -- the fallbacks follow rules, they do not reason.
 */
export function isDemoMode(): boolean {
  return process.env.SATLENS_DEMO === "1";
}

/** Errors we want to surface to the student as readable text, not a stack trace. */
export class AIError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AIError";
  }
}

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (client) return client;
  // Zero-arg construction so the SDK can resolve a key from the environment OR
  // from an `ant auth login` profile -- an unset ANTHROPIC_API_KEY does not mean
  // there are no credentials. Missing credentials surface at request time and
  // are translated in askStructured's catch block.
  client = new Anthropic();
  return client;
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

interface StructuredRequest<S extends z.ZodType> {
  system: string;
  messages: Anthropic.MessageParam[];
  schema: S;
  /** Higher effort for genuinely hard reasoning (pattern detection); lower for extraction. */
  effort?: Effort;
  maxTokens?: number;
  /**
   * Deterministic local stand-in used when SATLENS_DEMO=1. Returns the same
   * shape the schema describes, so every caller downstream is unchanged.
   */
  demo?: () => z.infer<S>;
}

/**
 * Single entry point for structured model calls. Handles the refusal stop
 * reason, null parses, and maps SDK errors onto readable messages.
 */
export async function askStructured<S extends z.ZodType>({
  system,
  messages,
  schema,
  effort = "high",
  maxTokens = 16000,
  demo,
}: StructuredRequest<S>): Promise<z.infer<S>> {
  if (isDemoMode() && demo) {
    // A little latency so the UI's pending states are visible on stage;
    // instant responses read as "nothing happened".
    await new Promise((resolve) => setTimeout(resolve, 550));
    // Parsed through the same schema the live path uses, so a malformed
    // fallback fails here rather than downstream.
    return schema.parse(demo()) as z.infer<S>;
  }

  const anthropic = getClient();

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      thinking: { type: "adaptive" },
      output_config: {
        format: zodOutputFormat(schema),
        effort,
      },
    });

    // Safety classifiers can decline with HTTP 200 -- check before reading content.
    if (response.stop_reason === "refusal") {
      throw new AIError(
        "The model declined to answer this request. Try rephrasing the question text.",
      );
    }

    if (response.parsed_output == null) {
      throw new AIError(
        "The model's response did not match the expected format. Try again.",
      );
    }

    return response.parsed_output as z.infer<S>;
  } catch (error) {
    if (error instanceof AIError) throw error;

    // Most specific first -- retryable and non-retryable failures read differently.
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AIError("Your ANTHROPIC_API_KEY was rejected. Check the key in .env.local.", 401);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AIError("Rate limited by the Claude API. Wait a moment and retry.", 429);
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new AIError(`The request was rejected: ${error.message}`, 400);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AIError("Could not reach the Claude API. Check your network connection.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AIError(`Claude API error (${error.status}): ${error.message}`, error.status);
    }

    // The SDK does not fail on construction when no credentials exist -- it
    // throws an untyped error at request time. There is no exception class for
    // it, so translate it here rather than leaking SDK internals into the UI.
    if (
      error instanceof Error &&
      /could not resolve authentication/i.test(error.message)
    ) {
      throw new AIError(
        "No Anthropic credentials found. Copy .env.example to .env.local, add your ANTHROPIC_API_KEY, and restart the dev server.",
        401,
      );
    }

    throw error;
  }
}

/** Shared framing so every SATLens prompt speaks with the same voice and priorities. */
export const TUTOR_SYSTEM = `You are the analysis engine behind SATLens, a diagnostic SAT tool.

Your job is not to tell a student that they got a question wrong -- they already know that. Your job is to explain WHY they got it wrong in a way that generalizes to the next question.

Principles:
- Be specific about the mechanism of the error. "Careless" and "needs more practice" are useless. "You picked the choice supported by paragraph 2 rather than the one supported by the whole passage" is useful.
- Name the trap when the wrong answer was engineered to be tempting. SAT distractors are designed, not random.
- Diagnose at the level of the recurring habit, not the individual question.
- Write for a motivated high-school student: direct, concrete, no jargon, no padding, no praise-sandwiching.
- Never reproduce copyrighted College Board material. When you write practice questions, they must be entirely original.`;
