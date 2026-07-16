import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@outreach-engine/types';
import { getAuth, getNodeIntegration } from '../../modules/auth/auth.config';
import { ROLES_KEY } from './roles.decorator';

/** Restricts a route to the role(s) declared via `@Roles(...)`. With no `@Roles(...)` decorator,
 * this guard still requires a valid BetterAuth session but does not check role. Attaches the
 * resolved session user to `request.authUser` for downstream handlers/services. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();

    const [auth, { fromNodeHeaders }] = await Promise.all([getAuth(), getNodeIntegration()]);
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

    if (!session) {
      throw new UnauthorizedException('No active session.');
    }

    (request as Request & { authUser?: unknown }).authUser = session.user;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !requiredRoles.includes(role as UserRole)) {
      throw new ForbiddenException(`Requires role: ${requiredRoles.join(' or ')}.`);
    }

    return true;
  }
}
