import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@outreach-engine/types';

export const ROLES_KEY = 'roles';

/** Restrict a route to one or more roles, e.g. `@Roles('admin')` for Business Line management,
 * or `@Roles('admin', 'operator')` for review-queue actions available to both. A route with no
 * `@Roles(...)` decorator is only guarded by authentication (a valid session), not role. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
