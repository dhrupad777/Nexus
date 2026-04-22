import { OnboardingChat } from "../_components/OnboardingChat";
import type { OrgType } from "@/lib/schemas";

type SearchParams = Promise<{ type?: string }>;

export default async function OnboardChatPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { type } = await searchParams;
  const normalized: OrgType | undefined =
    type === "NGO" || type === "ORG" ? type : undefined;
  return <OnboardingChat type={normalized} />;
}
