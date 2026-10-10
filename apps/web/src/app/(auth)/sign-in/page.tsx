import type { Metadata } from "next";
import { SignInHeader } from "./SignInHeader";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "scraps. sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <SignInHeader />
      <SignInForm notice={error === "link" || error === "underage" ? error : null} />
    </main>
  );
}
