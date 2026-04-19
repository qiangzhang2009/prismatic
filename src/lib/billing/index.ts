/**
 * Billing module — unified entry point
 */
export { resolveBillingMode, deductCreditsIfNeeded, addCredits, deductCredits } from './engine';
export type { BillingMode, LLMProviderType, BillingDecision } from './engine';
