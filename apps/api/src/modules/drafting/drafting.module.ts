import { Module } from '@nestjs/common';

/** Stub only, per Phase 1 spec — Claude-backed draft generation (Draft/DmDraft rows) lands in a
 * later phase. This module exists so the tree matches the spec and other modules can import it. */
@Module({})
export class DraftingModule {}
