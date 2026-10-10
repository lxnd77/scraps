import type { Metadata } from "next";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "scraps. settings" };

export default function SettingsPage() {
  return <SettingsView />;
}
