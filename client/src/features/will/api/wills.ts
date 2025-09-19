import type { WillForm } from "@shared/will-types";

export async function fetchCurrentWill(): Promise<WillForm> {
  const r = await fetch("/api/wills/current", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch will");
  return r.json();
}

export async function saveWill(form: WillForm) {
  const r = await fetch("/api/wills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(form),
  });
  if (!r.ok) throw new Error("Failed to save will");
  return r.json();
}

export async function generateWillPacket(form?: WillForm) {
  const r = await fetch("/api/wills/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: form ? JSON.stringify(form) : "{}",
  });
  if (!r.ok) throw new Error("Failed to generate");
  return r.json();
}

