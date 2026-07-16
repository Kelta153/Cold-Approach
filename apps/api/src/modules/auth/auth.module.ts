import { Module } from '@nestjs/common';

/**
 * BetterAuth itself is mounted as raw Express middleware in `main.ts` (its handler needs the
 * unparsed request body/stream — see the comment there), so this module has no controller of
 * its own. It exists so other modules have a conventional place to import
 * `@outreach-engine/api`'s auth-related providers (`RolesGuard`, `@Roles`) from, and so the
 * module tree matches `apps/api/src/modules/auth/` from the spec.
 */
@Module({})
export class AuthModule {}
