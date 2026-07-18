#!/usr/bin/env node
/**
 * Loads the repo-root `.env` and re-execs the given command with those vars injected.
 * Not a plain `dotenv -e` shim because we need to survive on Windows/git-bash where naive
 * `source .env` mis-parses unescaped `&` in connection strings as a shell background operator.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
}

const [cmd, ...args] = process.argv.slice(2);
const result = spawnSync(cmd, args, { cwd: process.cwd(), env, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
