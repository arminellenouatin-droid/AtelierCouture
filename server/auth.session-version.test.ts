import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Request } from "express";

process.env.DATABASE_URL = "pglite://:memory:";
process.env.JWT_SECRET = "test-session-version-secret";

import { users } from "../drizzle/schema";
import { appRouter } from "./routers";
import { createSessionToken, getSessionUser } from "./_core/auth";
import type { TrpcContext } from "./_core/context";
import { getDb, migrateDatabase } from "./db";
import { seed } from "./seed";

beforeAll(async () => {
  await migrateDatabase();
  await seed();
});

describe("révocation ciblée des sessions", () => {
  it("n’installe pas de mot de passe par défaut et invalide les anciens JWT", async () => {
    const db = (await getDb())!;
    const [demoUser] = await db.select().from(users).where(eq(users.email, "proprietaire@distinction.tg")).limit(1);
    expect(demoUser).toBeDefined();
    expect(demoUser.passwordHash).toBeNull();

    const token = await createSessionToken(demoUser.id, demoUser.sessionVersion);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    expect(await getSessionUser(req)).toMatchObject({ id: demoUser.id });

    await db.update(users).set({ sessionVersion: demoUser.sessionVersion + 1, passwordHash: null }).where(eq(users.id, demoUser.id));
    expect(await getSessionUser(req)).toBeNull();
  });

  it("refuse la connexion d’un compte démo sans mot de passe provisionné", async () => {
    const visitor = appRouter.createCaller({
      user: null,
      req: { protocol: "http", headers: {} } as TrpcContext["req"],
      res: { cookie: () => undefined } as unknown as TrpcContext["res"],
    });
    await expect(visitor.auth.login({ email: "proprietaire@distinction.tg", password: "invalid-test-only-password" })).rejects.toThrow(/incorrect/);
  });
});
