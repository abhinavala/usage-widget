export interface ManualOverride {
  tokensUsed?: number;
  tokensLimit?: number;
  requestsUsed?: number;
  requestsLimit?: number;
  isActive: boolean;
  expiresAt: Date;
}
