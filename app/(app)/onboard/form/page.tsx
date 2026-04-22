import { OnboardingFormPage } from "../_components/OnboardingFormPage";
import type { OrgType } from "@/lib/schemas";

type SearchParams = Promise<{ type?: string }>;

export default async function OnboardFormRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { type } = await searchParams;
  const normalized: OrgType | undefined =
    type === "NGO" || type === "ORG" ? type : undefined;
  return <OnboardingFormPage type={normalized} />;
}
