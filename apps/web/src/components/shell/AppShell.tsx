"use client";

import type { ReactNode } from "react";
import { AiProvider } from "@/components/ai/AiProvider";
import { InstallProvider } from "@/components/install/InstallProvider";
import { CaptureProvider } from "@/components/capture/CaptureProvider";
import { PaletteProvider } from "@/components/search/PaletteProvider";
import { OfflineBanner } from "./OfflineBanner";
import { OfflinePrefetch } from "./OfflinePrefetch";
import { QueryProvider } from "./QueryProvider";
import { ShellProvider, type ShellValue } from "./ShellContext";
import { SidebarContent } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

/**
 * Desktop (1024 and up): 260px sidebar + content.
 * Tablet (640 to 1023): top bar, sidebar becomes a drawer from the brand.
 * Phone (under 640): top bar and a bottom tab bar with the raised capture button.
 */
export function AppShell({ value, children }: { value: ShellValue; children: ReactNode }) {
  return (
    <ShellProvider value={value}>
      <QueryProvider>
        <OfflinePrefetch />
        <AiProvider>
        <CaptureProvider>
          <PaletteProvider>
            <InstallProvider>
              <a href="#main" className="skip-link">
                skip to content
              </a>
              <div className="shell">
                <aside className="shell__sidebar">
                  <SidebarContent />
                </aside>
                <div className="shell__main">
                  <TopBar />
                  <main id="main" className="shell__content">
                    <OfflineBanner />
                    {children}
                  </main>
                  <TabBar />
                </div>
              </div>
            </InstallProvider>
          </PaletteProvider>
        </CaptureProvider>
        </AiProvider>
      </QueryProvider>
    </ShellProvider>
  );
}
