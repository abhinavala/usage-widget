export type ProgressThreshold = 'low' | 'medium' | 'high'; // src/types/progress.ts

export interface ProgressBarConfig { lowThreshold: number; mediumThreshold: number; highThreshold: number; lowColor: string; mediumColor: string; highColor: string; } // src/types/progress.ts

export interface ProgressBarState { value: number; percentage: number; color: string; threshold: 'low' | 'medium' | 'high'; } // src/types/progress.ts
