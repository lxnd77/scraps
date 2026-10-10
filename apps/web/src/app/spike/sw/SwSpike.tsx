"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  if (!("serviceWorker" in navigator)) return () => {};
  navigator.serviceWorker.addEventListener("controllerchange", onChange);
  void navigator.serviceWorker.ready.then(onChange);
  return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
}

function snapshot(): string {
  if (!("serviceWorker" in navigator)) return "unsupported";
  return navigator.serviceWorker.controller ? "controlled" : "registered, not yet controlling";
}

function Status() {
  const state = useSyncExternalStore(subscribe, snapshot, () => "checking…");
  return (
    <main style={{ padding: 24 }}>
      <h1>service worker spike</h1>
      <p>
        state: <strong data-testid="sw-state">{state}</strong>
      </p>
    </main>
  );
}

export function SwSpike() {
  return (
    <SerwistProvider swUrl="/serwist/sw.js">
      <Status />
    </SerwistProvider>
  );
}
