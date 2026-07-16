import { Module } from '@nestjs/common';

/**
 * Stub only, per Phase 1 spec.
 *
 * IMPORTANT — Instagram DMs are manual-only by design, permanently, not just during this stub
 * phase: there is deliberately no `send`/`dispatch` method anywhere in this module, no queue
 * processor that calls the Meta Graph API to deliver a DM, and no code path that could send one
 * automatically. `DmSend` rows (see `packages/db/prisma/schema.prisma`) are written by an
 * operator manually confirming they sent a DM themselves ("marked sent"), not by this backend.
 * Do not add an automated-send code path here in a later phase without re-reading this comment
 * and the compliance rationale behind it.
 */
@Module({})
export class InstagramModule {}
