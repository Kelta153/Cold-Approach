import { Module } from '@nestjs/common';

/** Stub only, per Phase 1 spec — reply ingestion/classification (Reply/ReplyDraft rows) lands in
 * a later phase. This module exists so the tree matches the spec and other modules can import it. */
@Module({})
export class RepliesModule {}
