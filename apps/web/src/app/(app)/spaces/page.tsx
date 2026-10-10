import type { Metadata } from "next";
import { SpacesList } from "./SpacesList";

export const metadata: Metadata = { title: "scraps. spaces" };

export default function SpacesPage() {
  return <SpacesList />;
}
