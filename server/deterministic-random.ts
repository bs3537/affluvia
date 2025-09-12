/**
 * Global deterministic random number generator
 * This module provides a way to override Math.random() with a seeded implementation
 */

export class DeterministicRandom {
  private static instance: DeterministicRandom | null = null;
  private seed: number;
  private originalRandom: () => number;
  private enabled: boolean = false;

  constructor(seed: number) {
    this.seed = seed;
    this.originalRandom = Math.random;
  }

  /**
   * XorShift32 algorithm for deterministic random numbers
   */
  private next(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 0x100000000;
  }

  /**
   * Enable deterministic mode - overrides Math.random globally
   */
  static enable(seed: number): void {
    if (!DeterministicRandom.instance) {
      DeterministicRandom.instance = new DeterministicRandom(seed);
    } else {
      DeterministicRandom.instance.seed = seed;
    }
    
    if (!DeterministicRandom.instance.enabled) {
      DeterministicRandom.instance.enabled = true;
      // Store original Math.random
      DeterministicRandom.instance.originalRandom = Math.random;
      // Override Math.random
      Math.random = () => DeterministicRandom.instance!.next();
    }
  }

  /**
   * Disable deterministic mode - restores original Math.random
   */
  static disable(): void {
    if (DeterministicRandom.instance && DeterministicRandom.instance.enabled) {
      Math.random = DeterministicRandom.instance.originalRandom;
      DeterministicRandom.instance.enabled = false;
    }
  }

  /**
   * Reset the seed without changing enabled state
   */
  static reset(seed: number): void {
    if (DeterministicRandom.instance) {
      DeterministicRandom.instance.seed = seed;
    }
  }

  /**
   * Check if deterministic mode is enabled
   */
  static isEnabled(): boolean {
    return DeterministicRandom.instance?.enabled || false;
  }
}

/**
 * Helper function to run code with deterministic randomness
 */
export function withDeterministicRandom<T>(seed: number, fn: () => T): T {
  const wasEnabled = DeterministicRandom.isEnabled();
  
  try {
    DeterministicRandom.enable(seed);
    return fn();
  } finally {
    if (!wasEnabled) {
      DeterministicRandom.disable();
    }
  }
}