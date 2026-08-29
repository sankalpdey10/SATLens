"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { buttonStyles } from "./ui";

/**
 * Fire-and-refresh button for the model-backed endpoints. These calls take
 * real time (pattern detection runs at max effort), so the pending state is
 * explicit rather than a spinner that appears to hang.
 */
export function ActionButton({
  endpoint,
  body,
  children,
  pendingLabel = "Working...",
  variant = "primary",
  onDone,
}: {
  endpoint: string;
  body?: unknown;
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof buttonStyles;
  onDone?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      onDone?.(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button onClick={run} disabled={pending} className={buttonStyles[variant]}>
        {pending && (
          <span
            className="pulse size-1.5 rounded-full bg-current"
            aria-hidden
          />
        )}
        {pending ? pendingLabel : children}
      </button>
      {error && (
        <p className="text-[12.5px] text-[var(--critical)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
