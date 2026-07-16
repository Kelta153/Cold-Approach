import { Injectable } from '@nestjs/common';
import { runComplianceChokepoint } from '@outreach-engine/compliance-rules';
import type { SendCheckContext, SendCheckResult } from '@outreach-engine/types';

/**
 * Thin injectable wrapper around `@outreach-engine/compliance-rules`'s
 * `runComplianceChokepoint`. This is the *only* thing in `apps/api` that should call the
 * chokepoint — `sending.service.ts` calls this, nothing else should.
 */
@Injectable()
export class ComplianceService {
  runChokepoint(ctx: SendCheckContext): Promise<SendCheckResult> {
    return runComplianceChokepoint(ctx);
  }
}
