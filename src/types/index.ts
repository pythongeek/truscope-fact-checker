// src/types/index.ts

export * from './factCheck';
export * from './enhancedFactCheck';
export * from './corrections';
export * from './apiKeys';
export * from './advancedEditor';
export * from './factDatabase';

// We'll also define a new type for our Phase 3 AI Assistant here
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
