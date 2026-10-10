import type { Metadata } from "next";
import { getProfile } from "@scraps/db";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "scraps. welcome" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  if (profile?.onboarded_at) redirect("/");
  return <OnboardingForm defaultName={profile?.display_name ?? ""} />;
}
