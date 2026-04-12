export interface LoginFlowConfig {
  maxRetries: number;
  timeoutMs: number;
  baseUrl: string;
}

export interface LoginFlowState {
  isActive: boolean;
  currentStep: string;
  progress: number;
}
