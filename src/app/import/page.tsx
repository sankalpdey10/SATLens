import { ImportWorkbench } from "@/components/ImportWorkbench";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { DOMAINS } from "@/lib/taxonomy";
import { getSources } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  const sources = getSources();

  return (
    <>
      <PageHeader
        title="Import practice material"
        subtitle="Add questions by hand, paste an answer log, or upload a practice-test PDF. Everything extracted is shown for review before it is saved."
      />

      <ImportWorkbench
        taxonomy={DOMAINS.map((d) => ({
          section: d.section,
          domain: d.name,
          skills: d.skills.map((s) => s.name),
        }))}
      />

      {sources.length > 0 && (
        <Card className="mt-6">
          <CardTitle hint="Everything SATLens has analyzed so far.">
            Imported sources
          </CardTitle>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {sources.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="truncate text-[13.5px] text-[var(--text-primary)]">
                  {s.label}
                </span>
                <span className="tnum shrink-0 text-[12.5px] text-[var(--text-secondary)]">
                  {s.correct}/{s.total} correct
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
