// Re-export the shared estate analysis so client and server use the same logic.
export type {
  EstateProjectionSummary,
  EstateStrategyInputs,
  EstateAssetComposition,
  EstateAssumptionInputs,
  EstateCalculationInput,
} from "@shared/estate/analysis";

export { calculateEstateProjection, buildAssetCompositionFromProfile } from "@shared/estate/analysis";
