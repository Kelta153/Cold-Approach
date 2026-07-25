export interface DraftGenerationInput {
  /** Fully-assembled instructions + grounding facts, built entirely by the caller (apps/api's
   * DraftingService — see FR-DRF-1/2/3: grounding, content rules, compliance footer). Providers
   * must not add, drop, or reinterpret facts — their only job is turning this prompt into a
   * structured completion via their own API's mechanics. */
  prompt: string;
}

export interface DraftGenerationResult {
  subject: string;
  body: string;
  openPlaceholders: string[];
}

export interface LLMProvider {
  /** Persisted on Draft.model for audit — see schema.prisma. */
  readonly model: string;
  generateDraft(input: DraftGenerationInput): Promise<DraftGenerationResult>;
}
