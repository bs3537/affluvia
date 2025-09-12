/**
 * Seeded Random Number Generator for Monte Carlo Simulations
 * Provides deterministic, reproducible random number generation
 */

// Unified random source interface for deterministic simulations
export interface RandomSource {
  next(): number;           // uniform in [0,1)
  uniform(min?: number, max?: number): number;
  normal(): number;         // standard normal N(0,1)
  studentT(df: number): number;
  exponential(lambda?: number): number;
  poisson(lambda: number): number;
  randomInt(min: number, max: number): number;
}

export class RNG implements RandomSource {
  private seed: number;
  
  constructor(seed: number) {
    // Ensure seed is a positive 32-bit integer
    this.seed = (seed >>> 0) || 123456789;
  }
  
  /**
   * XorShift32 algorithm for fast, high-quality pseudo-random numbers
   * Returns a uniform random number in [0, 1)
   */
  next(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 0x100000000;
  }
  
  /**
   * Generate a normally distributed random number using Box-Muller transform
   * Returns a standard normal (mean=0, std=1)
   */
  normal(): number {
    const u = Math.max(this.next(), 1e-12);
    const v = Math.max(this.next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  
  /**
   * Generate a uniform random number in [min, max)
   */
  uniform(min: number = 0, max: number = 1): number {
    return min + (max - min) * this.next();
  }
  
  /**
   * Generate a random integer in [min, max] inclusive
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.uniform(min, max + 1));
  }
  
  /**
   * Generate Student's t-distributed random variable
   * @param df Degrees of freedom
   */
  studentT(df: number): number {
    // Generate standard normal
    const z = this.normal();
    
    // Generate chi-squared with df degrees of freedom
    let chiSquared = 0;
    for (let i = 0; i < df; i++) {
      const n = this.normal();
      chiSquared += n * n;
    }
    
    // Student's t = Z / sqrt(chi-squared / df)
    return z / Math.sqrt(chiSquared / df);
  }
  
  /**
   * Generate exponential random variable
   * @param lambda Rate parameter
   */
  exponential(lambda: number = 1): number {
    return -Math.log(1 - this.next()) / lambda;
  }
  
  /**
   * Generate Poisson random variable
   * @param lambda Expected value
   */
  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    
    do {
      k++;
      p *= this.next();
    } while (p > L);
    
    return k - 1;
  }
  
  /**
   * Clone the RNG with current state
   */
  clone(): RNG {
    const cloned = new RNG(this.seed);
    return cloned;
  }
  
  /**
   * Reset to a new seed
   */
  reset(seed: number): void {
    this.seed = (seed >>> 0) || 123456789;
  }
}

/**
 * Create an antithetic RNG that generates mirrored random values
 */
export class AntitheticRNG extends RNG {
  private baseRNG: RNG;
  private useAntithetic: boolean = false;
  private lastUniform: number = 0;
  private lastNormal: number = 0;
  private lastStudentT: number = 0;
  
  constructor(seed: number) {
    super(seed);
    this.baseRNG = new RNG(seed);
  }
  
  next(): number {
    if (this.useAntithetic) {
      // Return 1 - last value for antithetic
      return 1 - this.lastUniform;
    } else {
      this.lastUniform = this.baseRNG.next();
      return this.lastUniform;
    }
  }
  
  normal(): number {
    if (this.useAntithetic) {
      // Return negative of last value for antithetic
      return -this.lastNormal;
    } else {
      this.lastNormal = this.baseRNG.normal();
      return this.lastNormal;
    }
  }
  
  studentT(df: number): number {
    if (this.useAntithetic) {
      // Return negative of last value for antithetic
      // Student-t is symmetric around zero like normal
      return -this.lastStudentT;
    } else {
      this.lastStudentT = this.baseRNG.studentT(df);
      return this.lastStudentT;
    }
  }
  
  /**
   * Toggle between regular and antithetic mode
   */
  toggleAntithetic(): void {
    this.useAntithetic = !this.useAntithetic;
  }
  
  /**
   * Set antithetic mode
   */
  setAntithetic(antithetic: boolean): void {
    this.useAntithetic = antithetic;
  }
}

/**
 * RecordingRNG: wraps a base RNG and records draws for replay/antithetic use.
 */
export class RecordingRNG implements RandomSource {
  private base: RandomSource;
  // Tapes for each variate type
  private uniforms: number[] = [];
  private normals: number[] = [];
  private studentTs: Array<{ df: number; value: number }> = [];
  private exponentials: Array<{ lambda: number; value: number }> = [];
  private poissons: Array<{ lambda: number; value: number }> = [];
  private randomInts: Array<{ min: number; max: number; value: number }> = [];

  constructor(base: RandomSource) {
    this.base = base;
  }

  next(): number {
    const u = this.base.next();
    this.uniforms.push(u);
    return u;
  }

  uniform(min: number = 0, max: number = 1): number {
    const u = this.base.uniform(min, max);
    // Store the normalized [0,1) variate to allow antithetic mirroring
    // Convert back to [0,1) regardless of min/max
    const normalized = (u - min) / (max - min);
    this.uniforms.push(Math.max(0, Math.min(1 - Number.EPSILON, normalized)));
    return u;
  }

  normal(): number {
    const z = this.base.normal();
    this.normals.push(z);
    return z;
  }

  studentT(df: number): number {
    const t = this.base.studentT(df);
    this.studentTs.push({ df, value: t });
    return t;
  }

  exponential(lambda: number = 1): number {
    const v = this.base.exponential(lambda);
    this.exponentials.push({ lambda, value: v });
    return v;
  }

  poisson(lambda: number): number {
    const v = this.base.poisson(lambda);
    this.poissons.push({ lambda, value: v });
    return v;
  }

  randomInt(min: number, max: number): number {
    const v = this.base.randomInt(min, max);
    this.randomInts.push({ min, max, value: v });
    return v;
  }

  getTape() {
    return {
      uniforms: [...this.uniforms],
      normals: [...this.normals],
      studentTs: this.studentTs.map(x => ({ ...x })),
      exponentials: this.exponentials.map(x => ({ ...x })),
      poissons: this.poissons.map(x => ({ ...x })),
      randomInts: this.randomInts.map(x => ({ ...x }))
    };
  }
}

/**
 * ReplayRNG: replays a recorded tape, with optional antithetic mirroring
 * for symmetric distributions (uniform/normal/student-t).
 */
export class ReplayRNG implements RandomSource {
  private tape: ReturnType<RecordingRNG['getTape']>;
  private mirror: boolean;
  private idx = { u: 0, n: 0, t: 0, e: 0, p: 0, i: 0 };

  constructor(tape: ReturnType<RecordingRNG['getTape']>, options?: { antithetic?: boolean }) {
    this.tape = tape;
    this.mirror = options?.antithetic === true;
  }

  next(): number {
    const u = this.tape.uniforms[this.idx.u++] ?? 0.5;
    return this.mirror ? 1 - u : u;
  }

  uniform(min: number = 0, max: number = 1): number {
    const u = this.tape.uniforms[this.idx.u++] ?? 0.5;
    const base = this.mirror ? 1 - u : u;
    return min + (max - min) * base;
  }

  normal(): number {
    const z = this.tape.normals[this.idx.n++] ?? 0;
    return this.mirror ? -z : z;
  }

  studentT(df: number): number {
    const rec = this.tape.studentTs[this.idx.t++] ?? { df, value: 0 };
    // If df mismatch, still mirror the value for symmetry
    const val = rec.value;
    return this.mirror ? -val : val;
  }

  exponential(lambda: number = 1): number {
    const rec = this.tape.exponentials[this.idx.e++] ?? { lambda, value: 0 };
    // No antithetic mapping for exponential; replay value
    return rec.value;
  }

  poisson(lambda: number): number {
    const rec = this.tape.poissons[this.idx.p++] ?? { lambda, value: 0 };
    return rec.value;
  }

  randomInt(min: number, max: number): number {
    const rec = this.tape.randomInts[this.idx.i++] ?? { min, max, value: Math.floor((min + max) / 2) };
    return rec.value;
  }
}

/**
 * OverlayRNG: wraps a base RNG and overrides the first K draws
 * for selected variate types (e.g., normals), then falls back to base.
 */
export class OverlayRNG implements RandomSource {
  private base: RandomSource;
  private normalOverlay?: number[];
  private normalIdx = 0;
  private uniformOverlay?: number[];
  private uniformIdx = 0;

  constructor(base: RandomSource, overlay?: { normals?: number[]; uniforms?: number[] }) {
    this.base = base;
    this.normalOverlay = overlay?.normals;
    this.uniformOverlay = overlay?.uniforms;
  }

  next(): number {
    if (this.uniformOverlay && this.uniformIdx < this.uniformOverlay.length) {
      return this.uniformOverlay[this.uniformIdx++] ?? this.base.next();
    }
    return this.base.next();
  }

  uniform(min: number = 0, max: number = 1): number {
    if (this.uniformOverlay && this.uniformIdx < this.uniformOverlay.length) {
      const u = this.uniformOverlay[this.uniformIdx++] ?? this.base.next();
      return min + (max - min) * u;
    }
    return this.base.uniform(min, max);
  }

  normal(): number {
    if (this.normalOverlay && this.normalIdx < this.normalOverlay.length) {
      return this.normalOverlay[this.normalIdx++] ?? this.base.normal();
    }
    return this.base.normal();
  }

  studentT(df: number): number { return this.base.studentT(df); }
  exponential(lambda: number = 1): number { return this.base.exponential(lambda); }
  poisson(lambda: number): number { return this.base.poisson(lambda); }
  randomInt(min: number, max: number): number { return this.base.randomInt(min, max); }
}

// Simple 32-bit hash for deterministic seeding (djb2 variant)
export function hash32(input: string): number {
  let hash = 5381 >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash = (((hash << 5) + hash) ^ input.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Derive a child RNG deterministically.
 * - If a base is provided, consume a couple of uniforms and mix with a label hash.
 * - If no base is provided, seed from a stable hash of the label and salt.
 */
export function deriveRNG(base: RandomSource | undefined, label: string, salt: number = 0): RNG {
  const labelHash = hash32(label + '|' + salt.toString());
  if (base) {
    const a = Math.floor(base.next() * 0xffffffff) >>> 0;
    const b = Math.floor(base.next() * 0xffffffff) >>> 0;
    const mixed = (a ^ ((b << 1) | (b >>> 31)) ^ labelHash) >>> 0;
    return new RNG((mixed || 1) >>> 0);
  }
  return new RNG((labelHash || 1) >>> 0);
}
