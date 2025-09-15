// Utility helpers for working with assets from the intake profile
// Keep types permissive to avoid coupling to server schemas

export const LIQUID_ASSET_TYPES = new Set([
  "checking",
  "savings",
  "cash",
  "money-market",
  "certificate-of-deposit",
  "cash-management",
  "taxable-brokerage",
  "brokerage",
]);

export function normalizeAssetType(type: unknown): string {
  const t = (type ?? "").toString().trim().toLowerCase();
  return t.replace(/\s+/g, "-");
}

export function normalizeOwnerLabel(owner: unknown): string {
  const v = (owner ?? "").toString().toLowerCase();
  if (v === "user" || v === "self" || v === "me") return "Your";
  if (v === "spouse" || v === "partner") return "Spouse's";
  if (v === "joint") return "Joint";
  return "Your";
}

export function parseAssets(assets: unknown): any[] {
  try {
    if (Array.isArray(assets)) return assets as any[];
    if (typeof assets === "string") {
      const parsed = JSON.parse(assets);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

export function mapAssetsWithLabels(assetsArray: any[]): Array<{ id: string; name: string; value: number; type: string; owner?: any }>{
  return assetsArray.map((a: any, idx: number) => {
    const ownerLabel = normalizeOwnerLabel(a?.owner);
    const typeLabel = (a?.type || "").toString();
    const desc = (a?.description || "").toString().trim();
    const label = `${ownerLabel} ${desc || typeLabel || "Asset"}`;
    const id = a?._source?.plaidAccountId || a?.plaidAccountId || a?.id || `manual-${idx}`;
    const value = Number(a?.value) || 0;
    return { id, name: label, value, type: typeLabel, owner: a?.owner };
  });
}

export function filterLiquidAssets(allAssets: any[]): ReturnType<typeof mapAssetsWithLabels> {
  const list = parseAssets(allAssets);
  const filtered = list.filter((a: any) => LIQUID_ASSET_TYPES.has(normalizeAssetType(a?.type)));
  return mapAssetsWithLabels(filtered);
}

export function filter529Plans(allAssets: any[]): ReturnType<typeof mapAssetsWithLabels> {
  const list = parseAssets(allAssets);
  const filtered = list.filter((a: any) => {
    const t = normalizeAssetType(a?.type);
    return t.includes("529");
  });
  return mapAssetsWithLabels(filtered);
}

