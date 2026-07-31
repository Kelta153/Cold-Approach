import { beforeEach, describe, expect, it, vi } from 'vitest';

const createUserMock = vi.fn();
const setUserPasswordMock = vi.fn();
const removeUserMock = vi.fn();
const findManyMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: { user: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

vi.mock('../auth/auth.config', () => ({
  getAuth: vi.fn().mockResolvedValue({
    api: {
      createUser: (...args: unknown[]) => createUserMock(...args),
      setUserPassword: (...args: unknown[]) => setUserPasswordMock(...args),
      removeUser: (...args: unknown[]) => removeUserMock(...args),
    },
  }),
}));

vi.mock('./generate-password', () => ({
  generatePassword: vi.fn().mockReturnValue('GENERATED_PW_123!'),
}));

// vi.mock calls are hoisted above imports by vitest — see telegram.service.spec.ts's comment for
// why a plain static import (rather than a dynamic one) is safe and required here.
import { UsersService } from './users.service';

const HEADERS = new Headers();

describe('UsersService.create', () => {
  beforeEach(() => {
    createUserMock.mockReset();
    setUserPasswordMock.mockReset();
    removeUserMock.mockReset();
    findManyMock.mockReset();
  });

  it('rejects a malformed email without ever calling createUser', async () => {
    const service = new UsersService();

    await expect(service.create({ email: 'not-an-email', role: 'operator' }, HEADERS)).rejects.toThrow(
      /not a valid email/,
    );
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('rejects a role outside admin/operator without ever calling createUser', async () => {
    const service = new UsersService();

    await expect(
      service.create({ email: 'sam@example.com', role: 'superadmin' as never }, HEADERS),
    ).rejects.toThrow(/Role must be one of/);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('defaults the display name to the email local-part when none is given', async () => {
    createUserMock.mockResolvedValue({ user: { id: 'u_1', email: 'sam@example.com' } });
    const service = new UsersService();

    await service.create({ email: 'sam@example.com', role: 'operator' }, HEADERS);

    expect(createUserMock).toHaveBeenCalledWith({
      headers: HEADERS,
      body: { email: 'sam@example.com', password: 'GENERATED_PW_123!', name: 'sam', role: 'operator' },
    });
  });

  it('returns the same generated password that was sent to createUser, never a different one', async () => {
    createUserMock.mockResolvedValue({ user: { id: 'u_1', email: 'sam@example.com' } });
    const service = new UsersService();

    const result = await service.create({ email: 'sam@example.com', role: 'admin', name: 'Sam' }, HEADERS);

    expect(result.generatedPassword).toBe('GENERATED_PW_123!');
    expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ password: result.generatedPassword }) }));
  });
});

describe('UsersService.resetPassword', () => {
  beforeEach(() => {
    setUserPasswordMock.mockReset();
  });

  it('generates a new password and returns it', async () => {
    setUserPasswordMock.mockResolvedValue({ status: true });
    const service = new UsersService();

    const result = await service.resetPassword('u_1', HEADERS);

    expect(result.generatedPassword).toBe('GENERATED_PW_123!');
    expect(setUserPasswordMock).toHaveBeenCalledWith({ headers: HEADERS, body: { userId: 'u_1', newPassword: 'GENERATED_PW_123!' } });
  });
});

describe('UsersService.remove', () => {
  beforeEach(() => {
    removeUserMock.mockReset();
  });

  it('blocks removing your own account before ever calling removeUser', async () => {
    const service = new UsersService();

    await expect(service.remove('u_1', 'u_1', HEADERS)).rejects.toThrow(/cannot remove your own account/);
    expect(removeUserMock).not.toHaveBeenCalled();
  });

  it('removes a different user', async () => {
    removeUserMock.mockResolvedValue({ success: true });
    const service = new UsersService();

    await service.remove('u_2', 'u_1', HEADERS);

    expect(removeUserMock).toHaveBeenCalledWith({ headers: HEADERS, body: { userId: 'u_2' } });
  });
});
