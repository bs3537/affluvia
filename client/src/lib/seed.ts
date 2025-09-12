import { hash32 } from '@/workers/rng';

// Build a stable, non-zero 32-bit seed from params and an optional namespace label.
export function seedFromParams(params?: any, namespace: string = 'mc'): number {
  try {
    const base = params ? JSON.stringify(params) : '';
    const raw = `${namespace}|${base}`;
    const h = hash32(raw) >>> 0;
    return (h === 0 ? 1 : h) >>> 0;
  } catch (e) {
    // Fallback to namespace-only seed if params are not serializable
    const h = hash32(namespace) >>> 0;
    return (h === 0 ? 1 : h) >>> 0;
  }
}

// Convenience aliases for clarity in call sites
export const seedFromProfile = (profile: any, ns = 'profile') => seedFromParams(profile, ns);
export const seedFromRetirementParams = (mcParams: any, ns = 'retirement-params') => seedFromParams(mcParams, ns);

