import { BadRequestException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { prisma, type PrismaClient } from '@outreach-engine/db';
import { createScopedPrismaClient } from './scoped-prisma';

export const BUSINESS_LINE_HEADER = 'x-business-line-id';

/**
 * Request-scoped provider that resolves the "active" Business Line from the
 * `X-Business-Line-Id` request header and exposes a Prisma client that is automatically scoped
 * to it. Every business-line-scoped service should depend on this instead of accepting a
 * caller-supplied `businessLineId` — because this is `Scope.REQUEST`, any service that injects
 * it becomes request-scoped too, so there is no way to reuse a stale/wrong business line across
 * requests.
 */
@Injectable({ scope: Scope.REQUEST })
export class BusinessLineContext {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  /** The raw, resolved business line id for this request. Throws if the header is missing —
   * fail loudly rather than silently querying unscoped. */
  getBusinessLineId(): string {
    const header = this.request.headers[BUSINESS_LINE_HEADER];
    const id = Array.isArray(header) ? header[0] : header;
    if (!id) {
      throw new BadRequestException(`Missing required "${BUSINESS_LINE_HEADER}" header.`);
    }
    return id;
  }

  /** A Prisma client scoped to this request's business line. Every scoped-model query issued
   * through this client automatically has `businessLineId` forced in — see scoped-prisma.ts. */
  get db(): PrismaClient {
    return createScopedPrismaClient(prisma, this.getBusinessLineId());
  }
}
