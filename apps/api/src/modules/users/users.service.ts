import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { prisma } from '@outreach-engine/db';
import type { UserRole } from '@outreach-engine/types';
import { getAuth } from '../auth/auth.config';
import { generatePassword } from './generate-password';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: UserRole[] = ['admin', 'operator'];

export interface CreateUserInput {
  email: string;
  name?: string;
  role: UserRole;
}

/** The admin-only user-provisioning surface (see `docs/project.md`'s Auth section for the
 * broader BetterAuth setup). Every mutating call here forwards the caller's real request
 * `headers` into the corresponding `auth.api.*` call — BetterAuth's own permission/self-action
 * checks (e.g. "you cannot remove yourself") are gated on session context being present, and
 * skip themselves entirely for headerless server-to-server calls. `RolesGuard` already restricts
 * this whole module to `admin`, but re-passing headers gets BetterAuth's own checks running too,
 * rather than relying on a single layer. */
@Injectable()
export class UsersService {
  findAll() {
    return prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: CreateUserInput, headers: Headers): Promise<{ user: unknown; generatedPassword: string }> {
    const email = input.email.trim();
    if (!EMAIL_PATTERN.test(email)) {
      throw new BadRequestException(`"${input.email}" is not a valid email address.`);
    }
    if (!ROLES.includes(input.role)) {
      throw new BadRequestException(`Role must be one of: ${ROLES.join(', ')}.`);
    }

    const name = input.name?.trim() || email.split('@')[0];
    const password = generatePassword();

    const auth = await getAuth();
    const result = await auth.api.createUser({ headers, body: { email, password, name, role: input.role } });

    return { user: result.user, generatedPassword: password };
  }

  async resetPassword(userId: string, headers: Headers): Promise<{ generatedPassword: string }> {
    const password = generatePassword();
    const auth = await getAuth();
    await auth.api.setUserPassword({ headers, body: { userId, newPassword: password } });
    return { generatedPassword: password };
  }

  async remove(userId: string, callerId: string, headers: Headers): Promise<void> {
    if (userId === callerId) {
      // Defense-in-depth alongside BetterAuth's own same check (which only runs when session
      // headers are present — see this class's doc comment) — never rely on a single layer.
      throw new ForbiddenException('You cannot remove your own account.');
    }
    const auth = await getAuth();
    await auth.api.removeUser({ headers, body: { userId } });
  }
}
