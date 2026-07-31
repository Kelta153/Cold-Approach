import type { UserRole } from '@outreach-engine/types';
import { apiFetch } from '../api-client';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export async function getUsers(): Promise<UserRow[]> {
  return apiFetch<UserRow[]>('/users');
}

export interface CreateUserInput {
  email: string;
  name?: string;
  role: UserRole;
}

export async function createUser(input: CreateUserInput): Promise<{ user: UserRow; generatedPassword: string }> {
  return apiFetch<{ user: UserRow; generatedPassword: string }>('/users', { method: 'POST', body: input });
}

export async function resetUserPassword(id: string): Promise<{ generatedPassword: string }> {
  return apiFetch<{ generatedPassword: string }>(`/users/${id}/reset-password`, { method: 'POST' });
}

export async function removeUser(id: string): Promise<void> {
  await apiFetch(`/users/${id}`, { method: 'DELETE' });
}
