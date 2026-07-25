import { Injectable, Logger } from '@nestjs/common';
import { getLLMProvider } from '@outreach-engine/llm-provider';

export interface DraftGroundingInput {
  business: {
    name: string;
    category: string | null;
    address: string | null;
    website: string | null;
  };
  product: {
    name: string;
    description: string;
    keyFeatures: string[];
    link: string;
  };
  businessLine: {
    senderName: string;
    companyLegalName: string;
    postalAddress: string | null;
  };
  templateHint: string | null;
}

export interface DraftResult {
  subject: string;
  body: string;
  groundingFacts: { text: string; source: string }[];
  openPlaceholders: string[];
  model: string;
}

const logger = new Logger('DraftingService');

/** Grounding-fact assembly, content rules, and the compliance footer all live here — above the
 * `LLMProvider` abstraction — so they apply identically no matter which provider is active
 * (`LLM_PROVIDER=groq|haiku`, see @outreach-engine/llm-provider). No price ever enters the
 * prompt (cold copy must never quote price, per the Product/ProductVariant schema comments), and
 * the footer is appended deterministically in code afterwards rather than trusted to the model. */
@Injectable()
export class DraftingService {
  async draftEmail(input: DraftGroundingInput): Promise<DraftResult> {
    const groundingFacts = buildGroundingFacts(input);
    const provider = getLLMProvider();

    const result = await provider.generateDraft({ prompt: buildPrompt(input, groundingFacts) });

    logger.log(`[drafting] drafted email for "${input.business.name}" via ${provider.model}`);

    return {
      subject: result.subject,
      body: appendFooter(result.body, input.businessLine),
      groundingFacts,
      openPlaceholders: result.openPlaceholders,
      model: provider.model,
    };
  }
}

function buildGroundingFacts(input: DraftGroundingInput): { text: string; source: string }[] {
  const facts: { text: string; source: string }[] = [
    { text: `Business name: ${input.business.name}`, source: 'google_places' },
  ];
  if (input.business.category) facts.push({ text: `Business category: ${input.business.category}`, source: 'google_places' });
  if (input.business.address) facts.push({ text: `Business address: ${input.business.address}`, source: 'google_places' });
  if (input.business.website) facts.push({ text: `Business website: ${input.business.website}`, source: 'google_places' });

  facts.push({ text: `Our product: ${input.product.name} - ${input.product.description}`, source: 'catalogue' });
  if (input.product.keyFeatures.length > 0) {
    facts.push({ text: `Key features: ${input.product.keyFeatures.join(', ')}`, source: 'catalogue' });
  }
  facts.push({ text: `Product link: ${input.product.link}`, source: 'catalogue' });

  return facts;
}

function buildPrompt(input: DraftGroundingInput, facts: { text: string; source: string }[]): string {
  const factLines = facts.map((f) => `- ${f.text}`).join('\n');
  return `Write a short, warm, non-salesy cold outreach email introducing ${input.businessLine.senderName} at ${input.businessLine.companyLegalName} to the recipient business below.

Facts you may use — do not invent or assume any fact not listed here:
${factLines}

Rules:
- Never mention price or a specific dollar amount.
- Do not invent a recipient name — we don't know it. Greet the business generically (e.g. "Hi there,") and add "recipient name" to openPlaceholders.
- Keep the body under 120 words, plain text, no markdown.
- Sign off with just "${input.businessLine.senderName}" — do not add a footer, address, or unsubscribe line yourself; that is appended separately.
- Add to openPlaceholders any fact you were not confident enough to use.
${input.templateHint ? `\nHouse style example to match tone/structure (do not copy facts from it):\n${input.templateHint}` : ''}`;
}

function appendFooter(body: string, businessLine: DraftGroundingInput['businessLine']): string {
  const addressLine = businessLine.postalAddress ? `${businessLine.companyLegalName}, ${businessLine.postalAddress}` : businessLine.companyLegalName;
  return `${body.trim()}\n\n---\n${addressLine}\nIf you'd rather not hear from us again, just reply and let us know.`;
}
