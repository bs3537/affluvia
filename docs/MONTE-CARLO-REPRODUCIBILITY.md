Monte Carlo Reproducibility & Variance Reduction
================================================

Overview
--------
This document describes how the enhanced retirement Monte Carlo engine achieves deterministic, reproducible results and how its variance-reduction features (Antithetic Variates, Latin–Hypercube Sampling) are configured and validated.

Deterministic Random Number Generation (RNG)
--------------------------------------------
- Unified RNG: All randomness in the engine flows through a single `RandomSource` interface implemented by `RNG`.
- No `Math.random()`: The engine files do not call `Math.random()`; a lint script (`npm run lint:no-math-random`) enforces this for the core modules.
- Seeding scheme:
  - Sequential: Per-iteration base seed = `params.randomSeed || 12345` + `iterationIndex * 100007`.
  - Parallel: Per-worker `startSeed` = `params.randomSeed || 12345` + `workerId * 1_000_000`; each worker derives per-iteration base seed as in the sequential flow.
  - This scheme guarantees no overlaps and stable ordering between runs.

Antithetic Variates (AV)
------------------------
- True antithetic pairing is implemented using a Record/Replay design:
  - The original path runs with a `RecordingRNG` that tapes all variates used by the scenario.
  - The antithetic path replays the same tape via `ReplayRNG` with mirroring:
    - Uniforms: `u → 1 − u`
    - Normals/Student‑t: `z → −z`, `t → −t`
- This reduces estimator variance and keeps the entire scenario call graph synchronized across both paths.
- Configuration: `varianceReduction.useAntitheticVariates = true`.

Latin–Hypercube Sampling (LHS)
------------------------------
- The engine can apply LHS to the primary return shocks to further reduce Monte Carlo error without increasing iterations.
- Implementation notes:
  - LHS generates an `iterations × dims` matrix of standard normals; `dims` defaults to 30 (first 30 retirement years) where sequence risk is most impactful.
  - LHS is applied via `OverlayRNG` on a per‑iteration basis so only the first `dims` normal draws are overridden; subsequent draws use the base RNG.
- Configuration: `varianceReduction.useStratifiedSampling = true` and `useAntitheticVariates = false` (not combined in this release).
- Future: exposing `dims` is straightforward if needed.

Configuration Flags
-------------------
- `params.randomSeed: number`
  - Sets the base seed for both sequential and parallel runs.
- `varianceReduction.useAntitheticVariates: boolean`
  - Enables antithetic pairing (runs in pairs using record/replay).
- `varianceReduction.useStratifiedSampling: boolean`
  - Enables LHS overlays for the primary return shocks (when `useAntitheticVariates` is false).
- `varianceReduction.stratificationBins?: number`
  - Currently used by older seed‑based stratified sampling; LHS does not require bins.

Scope of Determinism
--------------------
- Deterministic within a fixed engine version and configuration across sequential and parallel runs.
- Numeric tolerances: End results should match to within floating‑point rounding; test scripts use tight tolerances.
- Any change to assumptions, calibration, or return models will change outputs for the same seed (by design).

Validation & Test Scripts
-------------------------
- Determinism: `npx tsx test-determinism-mc.ts`
  - Runs two sequential simulations with the same seed and compares key outputs.
- Variance Reduction (LHS): `npx tsx test-lhs-variance.ts`
  - Compares the variance of successProbability across trials for baseline vs LHS at fixed iterations.
- Parallel vs Sequential: `npx tsx test-parallel-vs-sequential.ts`
  - Confirms parallel results match sequential results under a fixed seed.
- Lint Gate (no Math.random): `npm run lint:no-math-random`
  - Fails if core engine modules call `Math.random()`.

Limitations & Notes
-------------------
- LHS + Antithetic: Not combined in this release to avoid path‑order interactions; can be added later with careful design.
- Overlay coverage: LHS targets the first `dims` normal draws (years) to achieve most variance reduction at low complexity.
- Deterministic fallbacks: If a function is invoked without an RNG (should not happen inside the engine), deterministic fallback RNGs are used instead of `Math.random()`.

Operational Guidance
--------------------
- Always set `params.randomSeed` in production runs for reproducibility.
- Choose either Antithetic or LHS depending on workload and desired convergence rate:
  - AV is simple and generally reduces variance ~30–50%.
  - LHS can further reduce variance for tail‑sensitive metrics at fixed iteration counts.
- Prefer running parallel simulations for throughput; parallel uses deterministic per‑worker seeding.

CI Suggestions
--------------
- Add a CI job that runs:
  - `npm run lint:no-math-random` to enforce no `Math.random()` in engine modules.
  - `npx tsx test-determinism-mc.ts` and `npx tsx test-parallel-vs-sequential.ts` to verify reproducibility guarantees on each change.
  - Optionally `npx tsx test-lhs-variance.ts` as a non‑blocking job to observe variance improvements over time.
