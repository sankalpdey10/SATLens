import { PlanWorkbench } from "@/components/PlanWorkbench";
import { PageHeader } from "@/components/ui";
import { getProfile } from "@/lib/repo";
import { getOverview } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default function PlanPage() {
  const profile = getProfile();
  const overview = getOverview();

  return (
    <>
      <PageHeader
        title="Study plan"
        subtitle="A schedule weighted by where you are actually losing points. Regenerate it after each practice test and it re-weights itself."
      />
      <PlanWorkbench
        profile={profile}
        hasData={overview.total > 0}
        diagnosed={overview.diagnosed}
      />
    </>
  );
}
