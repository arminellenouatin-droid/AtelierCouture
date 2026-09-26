/**
 * Authentification locale (email + mot de passe), sessions signées JWT
 * stockées dans un cookie httpOnly. Le rôle `admin` est réservé à l'équipe
 * opératrice ENVOL (administration de la plateforme).
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { getSessionCookieOptions } from "./cookies";
import { eq } from "drizzle-orm";
import { users, type User } from "../../drizzle/schema";
import { getDb } from "../db";

export const SESSION_COOKIE = "app_session_id";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function secretKey(): Uint8Array {
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET doit être défini en production");
  }
  const secret = process.env.JWT_SECRET || "atelier-manager-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createSessionToken(userId: number, sessionVersion = 0): Promise<string> {
  return new SignJWT({ sub: String(userId), sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

type SessionClaims = { userId: number; sessionVersion: number };

export async function readSessionClaims(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = Number(payload.sub);
    const sessionVersion = payload.sv === undefined ? 0 : Number(payload.sv);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(sessionVersion) || sessionVersion < 0) return null;
    return { userId, sessionVersion };
  } catch {
    return null;
  }
}

export async function readSessionClaimsFromRequest(req: Request): Promise<SessionClaims | null> {
  // 1) Cookie de session (accès direct, cookies acceptés).
  const header = req.headers.cookie ?? "";
  const token = parseCookieHeader(header)[SESSION_COOKIE];
  if (token) return readSessionClaims(token);
  // 2) En-tête Authorization: Bearer (aperçu en iframe avec cookies tiers bloqués).
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return readSessionClaims(auth.slice(7));
  return null;
}

export async function getSessionUser(req: Request): Promise<User | null> {
  const claims = await readSessionClaimsFromRequest(req);
  if (!claims) return null;
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, claims.userId)).limit(1);
  const user = result[0];
  return user && user.sessionVersion === claims.sessionVersion ? user : null;
}

export function sessionCookieOptions(req: Request) {
  // Attributes identiques au clearCookie de logout (voir cookies.ts) :
  // SameSite=None ; Secure derrière HTTPS (aperçu iframe), Lax en local.
  return {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
