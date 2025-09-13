// Deterministic RNG for client workers (mirrors server RNG subset)

export interface RandomSource {
  next(): number;           // uniform in [0,1)
  uniform(min?: number, max?: number): number;
  normal(): number;         // standard normal N(0,1)
}

export class RNG implements RandomSource {
  private seed: number;

  constructor(seed: number) {
    this.seed = (seed >>> 0) || 123456789;
  }

  next(): number {
    let x = this.seed >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 0x100000000;
  }

  uniform(min: number = 0, max: number = 1): number {
    return min + (max - min) * this.next();
  }

  normal(): number {
    const u = Math.max(this.next(), 1e-12);
    const v = Math.max(this.next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

export function hash32(input: string): number {
  let hash = 5381 >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash = (((hash << 5) + hash) ^ input.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

export function deriveRNG(base: RandomSource | undefined, label: string, salt: number = 0): RNG {
  // Without base, use a stable seed from label+salt
  if (!base) {
    const h = hash32(label + '|' + salt.toString());
    return new RNG((h || 1) >>> 0);
  }
  // With base, consume a couple uniforms and mix with label hash
  const a = Math.floor(base.next() * 0xffffffff) >>> 0;
  const b = Math.floor(base.next() * 0xffffffff) >>> 0;
  const h = hash32(label + '|' + salt.toString());
  const mixed = (a ^ ((b << 1) | (b >>> 31)) ^ h) >>> 0;
  return new RNG((mixed || 1) >>> 0);
}

