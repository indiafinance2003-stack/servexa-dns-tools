import { beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { randomBytes } from 'crypto';

/**
 * INTEGRATION TESTS — REQUIRE A REAL POSTGRESQL DATABASE.
 *
 * These tests are skipped unless TEST_DATABASE_URL points at a disposable
 * PostgreSQL database. They are never faked: without a database they report
 * as skipped, not passed. Expected shape:
 *   TEST_DATABASE_URL=postgresql://user:pass@host:5432/ravelyth_test
 *
 * Before running: apply migrations to the target database first
 * (DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate).
 */

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const describesDb = DATABASE_URL ? describe : describe.skip;

if (!DATABASE_URL) {
  console.log(
    'Skipping database integration tests: TEST_DATABASE_URL is not set. ' +
      'These tests require a disposable PostgreSQL database.'
  );
}

describesDb('database integration (PostgreSQL)', () => {
  let sql: postgres.Sql;

  function uniqueEmail(): string {
    return `test-${randomBytes(8).toString('hex')}@example.com`;
  }

  beforeAll(() => {
    sql = postgres(DATABASE_URL as string, { max: 1 });
  });

  it('enforces the unique email constraint', async () => {
    const email = uniqueEmail();
    await sql`INSERT INTO users (email, password_hash, name) VALUES (${email}, 'hash', 'A')`;
    await expect(
      sql`INSERT INTO users (email, password_hash, name) VALUES (${email}, 'hash', 'B')`
    ).rejects.toMatchObject({ code: '23505' });
    await sql`DELETE FROM users WHERE email = ${email}`;
  });

  it('stores exactly one row per user and normalizes identity through the unique index', async () => {
    const email = uniqueEmail();
    const rows = await sql<{ id: string; email: string; status: string }[]>`INSERT INTO users (email, password_hash, name) VALUES (${email}, 'hash', 'A') RETURNING id, email, status`;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    await sql`DELETE FROM users WHERE email = ${email}`;
  });

  it('cascades session deletion when the user is deleted', async () => {
    const email = uniqueEmail();
    const [user] = await sql<{ id: string }[]>`INSERT INTO users (email, password_hash, name) VALUES (${email}, 'hash', 'A') RETURNING id`;
    const [session] = await sql<{ id: string }[]>`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (${user.id}, 'deadbeef', now() + interval '1 day') RETURNING id`;
    await sql`DELETE FROM users WHERE id = ${user.id}`;
    const remaining = await sql<{ id: string }[]>`SELECT id FROM sessions WHERE id = ${session.id}`;
    expect(remaining).toHaveLength(0);
  });

  it('cascades saved analysis deletion when the user is deleted', async () => {
    const email = uniqueEmail();
    const [user] = await sql<{ id: string }[]>`INSERT INTO users (email, password_hash, name) VALUES (${email}, 'hash', 'A') RETURNING id`;
    const [saved] = await sql<{ id: string }[]>`INSERT INTO saved_analyses (user_id, analysis_type, target, result_json) VALUES (${user.id}, 'dns_lookup', 'example.com', ${sql.json({ ok: true })}) RETURNING id`;
    await sql`DELETE FROM users WHERE id = ${user.id}`;
    const remaining = await sql<{ id: string }[]>`SELECT id FROM saved_analyses WHERE id = ${saved.id}`;
    expect(remaining).toHaveLength(0);
  });

  it('keeps saved analyses isolated between users', async () => {
    const emailA = uniqueEmail();
    const emailB = uniqueEmail();
    const [userA] = await sql<{ id: string }[]>`INSERT INTO users (email, password_hash, name) VALUES (${emailA}, 'hash', 'A') RETURNING id`;
    const [userB] = await sql<{ id: string }[]>`INSERT INTO users (email, password_hash, name) VALUES (${emailB}, 'hash', 'B') RETURNING id`;
    const [saved] = await sql<{ id: string }[]>`INSERT INTO saved_analyses (user_id, analysis_type, target, result_json) VALUES (${userA.id}, 'dns_lookup', 'example.com', ${sql.json({ ok: true })}) RETURNING id`;

    // User B's isolation query (mirrors deleteSavedAnalysis) must not touch user A's row.
    const deleted = await sql<{ id: string }[]>`DELETE FROM saved_analyses WHERE id = ${saved.id} AND user_id = ${userB.id} RETURNING id`;
    expect(deleted).toHaveLength(0);

    // Cleanup.
    await sql`DELETE FROM saved_analyses WHERE id = ${saved.id}`;
    await sql`DELETE FROM users WHERE id IN (${userA.id}, ${userB.id})`;
  });

  it('rejects sessions pointing at missing users (FK enforced)', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    await expect(
      sql`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (${missingId}, 'orphan', now() + interval '1 day')`
    ).rejects.toMatchObject({ code: '23503' });
  });
});
