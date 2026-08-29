import { PracticeSession } from "@/components/PracticeSession";
import { PageHeader } from "@/components/ui";
import { getPattern } from "@/lib/repo";
import { getWeakestSkills } from "@/lib/stats";
import { ALL_SKILLS, DOMAINS, findSkill } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; pattern?: string }>;
}) {
  const params = await searchParams;
  const skill = params.skill ? findSkill(params.skill) : null;
  const pattern = params.pattern ? getPattern(params.pattern) : null;

  // Default the picker to the student's weakest skill -- the whole point is
  // that practice is targeted, so an unfiltered list is the wrong landing state.
  const weakest = getWeakestSkills(1)[0];
  const initialSkill = skill?.name ?? pattern?.skill ?? weakest?.skill ?? "";

  return (
    <>
      <PageHeader
        title="Targeted practice"
        subtitle={
          pattern
            ? `Retesting the pattern "${pattern.title}". SATLens will write a question that creates a real opportunity for this exact mistake.`
            : "Questions are generated against your specific failure mechanism, not picked at random from a topic bank."
        }
      />

      <PracticeSession
        initialSkill={initialSkill}
        patternId={pattern?.id ?? null}
        patternTitle={pattern?.title ?? null}
        skills={ALL_SKILLS.map((s) => ({ name: s.name, domain: s.domain }))}
        domains={DOMAINS.map((d) => ({
          section: d.section,
          domain: d.name,
          skills: d.skills.map((s) => s.name),
        }))}
      />
    </>
  );
}
