"use client";

import { createContext, useContext } from "react";

export interface SpaceMemberInfo {
  id: string;
  name: string;
  sticker?: string;
  /** accent name, stable per person */
  accent: "yellow" | "lime" | "pink" | "blue" | "lilac" | "orange";
}

const MembersContext = createContext<SpaceMemberInfo[]>([]);

/** The people in the note's space, for assignee pickers and avatars. */
export const MembersProvider = MembersContext.Provider;

export function useMembers(): SpaceMemberInfo[] {
  return useContext(MembersContext);
}
