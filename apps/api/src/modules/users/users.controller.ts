import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '@outreach-engine/types';
import { getNodeIntegration } from '../auth/auth.config';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService, type CreateUserInput } from './users.service';

type RequestWithAuthUser = Request & { authUser?: { id: string } };

/** Provisioning real logins for teammates — entirely admin-only, unlike most other modules here
 * operators have no read access either (see `RolesGuard`). */
@Controller('users')
@UseGuards(RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@Req() req: Request, @Body() body: { email: string; name?: string; role: UserRole }) {
    const headers = await this.headersFrom(req);
    return this.usersService.create(body as CreateUserInput, headers);
  }

  @Post(':id/reset-password')
  async resetPassword(@Req() req: Request, @Param('id') id: string) {
    const headers = await this.headersFrom(req);
    return this.usersService.resetPassword(id, headers);
  }

  @Delete(':id')
  async remove(@Req() req: RequestWithAuthUser, @Param('id') id: string) {
    const headers = await this.headersFrom(req);
    await this.usersService.remove(id, req.authUser!.id, headers);
    return { success: true };
  }

  private async headersFrom(req: Request): Promise<Headers> {
    const { fromNodeHeaders } = await getNodeIntegration();
    return fromNodeHeaders(req.headers);
  }
}
