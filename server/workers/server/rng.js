/**
 * Seeded Random Number Generator for Monte Carlo Simulations
 * Provides deterministic, reproducible random number generation
 */
export class RNG {
    constructor(seed) {
        // Ensure seed is a positive 32-bit integer
        this.seed = (seed >>> 0) || 123456789;
    }
    /**
     * XorShift32 algorithm for fast, high-quality pseudo-random numbers
     * Returns a uniform random number in [0, 1)
     */
    next() {
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
    normal() {
        const u = Math.max(this.next(), 1e-12);
        const v = Math.max(this.next(), 1e-12);
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    /**
     * Generate a uniform random number in [min, max)
     */
    uniform(min = 0, max = 1) {
        return min + (max - min) * this.next();
    }
    /**
     * Generate a random integer in [min, max] inclusive
     */
    randomInt(min, max) {
        return Math.floor(this.uniform(min, max + 1));
    }
    /**
     * Generate Student's t-distributed random variable
     * @param df Degrees of freedom
     */
    studentT(df) {
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
    exponential(lambda = 1) {
        return -Math.log(1 - this.next()) / lambda;
    }
    /**
     * Generate Poisson random variable
     * @param lambda Expected value
     */
    poisson(lambda) {
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
    clone() {
        const cloned = new RNG(this.seed);
        return cloned;
    }
    /**
     * Reset to a new seed
     */
    reset(seed) {
        this.seed = (seed >>> 0) || 123456789;
    }
}
/**
 * Create an antithetic RNG that generates mirrored random values
 */
export class AntitheticRNG extends RNG {
    constructor(seed) {
        super(seed);
        this.useAntithetic = false;
        this.lastUniform = 0;
        this.lastNormal = 0;
        this.lastStudentT = 0;
        this.baseRNG = new RNG(seed);
    }
    next() {
        if (this.useAntithetic) {
            // Return 1 - last value for antithetic
            return 1 - this.lastUniform;
        }
        else {
            this.lastUniform = this.baseRNG.next();
            return this.lastUniform;
        }
    }
    normal() {
        if (this.useAntithetic) {
            // Return negative of last value for antithetic
            return -this.lastNormal;
        }
        else {
            this.lastNormal = this.baseRNG.normal();
            return this.lastNormal;
        }
    }
    studentT(df) {
        if (this.useAntithetic) {
            // Return negative of last value for antithetic
            // Student-t is symmetric around zero like normal
            return -this.lastStudentT;
        }
        else {
            this.lastStudentT = this.baseRNG.studentT(df);
            return this.lastStudentT;
        }
    }
    /**
     * Toggle between regular and antithetic mode
     */
    toggleAntithetic() {
        this.useAntithetic = !this.useAntithetic;
    }
    /**
     * Set antithetic mode
     */
    setAntithetic(antithetic) {
        this.useAntithetic = antithetic;
    }
}
/**
 * RecordingRNG: wraps a base RNG and records draws for replay/antithetic use.
 */
export class RecordingRNG {
    constructor(base) {
        // Tapes for each variate type
        this.uniforms = [];
        this.normals = [];
        this.studentTs = [];
        this.exponentials = [];
        this.poissons = [];
        this.randomInts = [];
        this.base = base;
    }
    next() {
        const u = this.base.next();
        this.uniforms.push(u);
        return u;
    }
    uniform(min = 0, max = 1) {
        const u = this.base.uniform(min, max);
        // Store the normalized [0,1) variate to allow antithetic mirroring
        // Convert back to [0,1) regardless of min/max
        const normalized = (u - min) / (max - min);
        this.uniforms.push(Math.max(0, Math.min(1 - Number.EPSILON, normalized)));
        return u;
    }
    normal() {
        const z = this.base.normal();
        this.normals.push(z);
        return z;
    }
    studentT(df) {
        const t = this.base.studentT(df);
        this.studentTs.push({ df, value: t });
        return t;
    }
    exponential(lambda = 1) {
        const v = this.base.exponential(lambda);
        this.exponentials.push({ lambda, value: v });
        return v;
    }
    poisson(lambda) {
        const v = this.base.poisson(lambda);
        this.poissons.push({ lambda, value: v });
        return v;
    }
    randomInt(min, max) {
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
export class ReplayRNG {
    constructor(tape, options) {
        this.idx = { u: 0, n: 0, t: 0, e: 0, p: 0, i: 0 };
        this.tape = tape;
        this.mirror = options?.antithetic === true;
    }
    next() {
        const u = this.tape.uniforms[this.idx.u++] ?? 0.5;
        return this.mirror ? 1 - u : u;
    }
    uniform(min = 0, max = 1) {
        const u = this.tape.uniforms[this.idx.u++] ?? 0.5;
        const base = this.mirror ? 1 - u : u;
        return min + (max - min) * base;
    }
    normal() {
        const z = this.tape.normals[this.idx.n++] ?? 0;
        return this.mirror ? -z : z;
    }
    studentT(df) {
        const rec = this.tape.studentTs[this.idx.t++] ?? { df, value: 0 };
        // If df mismatch, still mirror the value for symmetry
        const val = rec.value;
        return this.mirror ? -val : val;
    }
    exponential(lambda = 1) {
        const rec = this.tape.exponentials[this.idx.e++] ?? { lambda, value: 0 };
        // No antithetic mapping for exponential; replay value
        return rec.value;
    }
    poisson(lambda) {
        const rec = this.tape.poissons[this.idx.p++] ?? { lambda, value: 0 };
        return rec.value;
    }
    randomInt(min, max) {
        const rec = this.tape.randomInts[this.idx.i++] ?? { min, max, value: Math.floor((min + max) / 2) };
        return rec.value;
    }
}
/**
 * OverlayRNG: wraps a base RNG and overrides the first K draws
 * for selected variate types (e.g., normals), then falls back to base.
 */
export class OverlayRNG {
    constructor(base, overlay) {
        this.normalIdx = 0;
        this.uniformIdx = 0;
        this.base = base;
        this.normalOverlay = overlay?.normals;
        this.uniformOverlay = overlay?.uniforms;
    }
    next() {
        if (this.uniformOverlay && this.uniformIdx < this.uniformOverlay.length) {
            return this.uniformOverlay[this.uniformIdx++] ?? this.base.next();
        }
        return this.base.next();
    }
    uniform(min = 0, max = 1) {
        if (this.uniformOverlay && this.uniformIdx < this.uniformOverlay.length) {
            const u = this.uniformOverlay[this.uniformIdx++] ?? this.base.next();
            return min + (max - min) * u;
        }
        return this.base.uniform(min, max);
    }
    normal() {
        if (this.normalOverlay && this.normalIdx < this.normalOverlay.length) {
            return this.normalOverlay[this.normalIdx++] ?? this.base.normal();
        }
        return this.base.normal();
    }
    studentT(df) { return this.base.studentT(df); }
    exponential(lambda = 1) { return this.base.exponential(lambda); }
    poisson(lambda) { return this.base.poisson(lambda); }
    randomInt(min, max) { return this.base.randomInt(min, max); }
}
// Simple 32-bit hash for deterministic seeding (djb2 variant)
export function hash32(input) {
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
export function deriveRNG(base, label, salt = 0) {
    const labelHash = hash32(label + '|' + salt.toString());
    if (base) {
        const a = Math.floor(base.next() * 0xffffffff) >>> 0;
        const b = Math.floor(base.next() * 0xffffffff) >>> 0;
        const mixed = (a ^ ((b << 1) | (b >>> 31)) ^ labelHash) >>> 0;
        return new RNG((mixed || 1) >>> 0);
    }
    return new RNG((labelHash || 1) >>> 0);
}
