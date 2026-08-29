import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  PatternStatusBadge,
} from "@/components/ui";
import { getPattern, listPatterns } from "@/lib/repo";
import { getOverview } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default function PatternsPage() {
  const patterns = listPatterns();
  const overview = getOverview();

  const detectButton = (
    <ActionButton
      endpoint="/api/patterns/detect"
      pendingLabel="Analyzing your history..."
      variant={patterns.length ? "secondary" : "primary"}
    >
      {patterns.length ? "Re-run detection" : "Detect patterns"}
    </ActionButton>
  );

  return (
    <>
      <PageHeader
        title="Recurring mistake patterns"
        subtitle="Not topics you score low on -- the specific reasoning move that keeps going wrong, with the questions that prove it."
        action={overview.diagnosed >= 3 ? detectButton : undefined}
      />

      {patterns.length === 0 ? (
        <EmptyState
          icon={
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
              <path d="M8.5 11.5 11 14l4-4.5" />
            </svg>
          }
          title={
            overview.diagnosed >= 3
              ? "No patterns detected yet"
              : "Not enough diagnosed mistakes yet"
          }
          body={
            overview.diagnosed >= 3
              ? `You have ${overview.diagnosed} diagnosed mistakes. Run detection and SATLens will look for the same reasoning error recurring across them.`
              : `Pattern detection needs at least 3 diagnosed mistakes to say anything meaningful. You have ${overview.diagnosed}. Import more questions and diagnose them first.`
          }
          action={
            overview.diagnosed >= 3 ? (
              detectButton
            ) : overview.undiagnosed > 0 ? (
              <ActionButton
                endpoint="/api/analyze"
                body={{ limit: 10 }}
                pendingLabel="Diagnosing..."
              >
                Diagnose {Math.min(overview.undiagnosed, 10)} pending mistakes
              </ActionButton>
            ) : (
              <LinkButton href="/import">Import practice material</LinkButton>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {patterns.map((p) => {
            const detail = getPattern(p.id);
            const retests = detail?.retests ?? [];
            const retestCorrect = retests.filter((r) => r.isCorrect).length;

            return (
              <Card key={p.id}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-[var(--text-primary)]">
                    <Link href={`/patterns/${p.id}`} className="hover:text-[var(--accent)]">
                      {p.title}
                    </Link>
                  </h2>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <PatternStatusBadge status={p.status} />
                    <Badge
                      tone={
                        p.severity === "high"
                          ? "critical"
                          : p.severity === "moderate"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {p.severity} impact
                    </Badge>
                  </div>
                </div>

                <p className="mb-3 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {p.description}
                </p>

                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--text-muted)]">
                  <span>
                    {p.domain}
                    {p.skill ? ` › ${p.skill}` : ""}
                  </span>
                  <span>
                    {detail?.evidence.length ?? 0} questions as evidence
                  </span>
                  <span>
                    {p.first_seen} – {p.last_seen}
                  </span>
                  {retests.length > 0 && (
                    <span>
                      {retestCorrect}/{retests.length} correct since
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <LinkButton href={`/patterns/${p.id}`} variant="secondary">
                    View pattern
                  </LinkButton>
                  <LinkButton
                    href={`/practice?pattern=${p.id}${p.skill ? `&skill=${encodeURIComponent(p.skill)}` : ""}`}
                  >
                    Practice this pattern
                  </LinkButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
