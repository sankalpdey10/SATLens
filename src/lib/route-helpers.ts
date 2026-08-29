import { NextResponse } from "next/server";
import { AIError } from "./ai";

/** Route handlers are long-running (model calls) and must not be cached. */
export const ROUTE_CONFIG = {
  runtime: "nodejs" as const,
  dynamic: "force-dynamic" as const,
  maxDuration: 300,
};

export function ok<T>(data: T) {
  return NextResponse.json(data);
}

export function fail(error: unknown) {
  if (error instanceof AIError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status && error.status >= 400 ? error.status : 502 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("[satlens]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
