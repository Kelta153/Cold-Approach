/**
 * One-off: creates the demo admin/operator accounts through BetterAuth's own sign-up flow
 * (so password hashing/Account rows are 100% what its sign-in verification expects), then
 * promotes their role — sign-up's `role` additionalField is `input: false` (no self-serve
 * escalation), so this is the "out-of-band" promotion path referenced in auth.config.ts.
 *
 * Run once per environment: `pnpm --filter @outreach-engine/api exec tsx src/scripts/bootstrap-demo-users.ts`
 */
import { prisma } from '@outreach-engine/db';
import { getAuth } from '../modules/auth/auth.config';

const DEMO_PASSWORD = 'StinkSafe#2026';

async function ensureUser(email: string, name: string, role: 'admin' | 'operator') {
  const auth = await getAuth();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists (id=${existing.id}, role=${existing.role}) — skipping sign-up, syncing role.`);
    await prisma.user.update({ where: { email }, data: { role } });
    return;
  }

  await auth.api.signUpEmail({ body: { email, password: DEMO_PASSWORD, name } });
  await prisma.user.update({ where: { email }, data: { role } });
  console.log(`Created ${email} via BetterAuth sign-up, role=${role}.`);
}

async function main() {
  await ensureUser('admin@stinksafe.co.uk', 'Stink Safe Admin', 'admin');
  await ensureUser('operator@stinksafe.co.uk', 'Stink Safe Operator', 'operator');
  console.log(`Done. Demo password for both accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
