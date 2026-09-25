import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { markOnlinePaymentSucceeded, verifyMonerooSignature } from "../routers/shop";
import { extractSucceededPaymentId } from "../domain/payments";
import { getDb } from "../db";

/** Construit l’API HTTP commune au serveur local et aux fonctions Netlify. */
export function createApplication() {
  const app = express();

  // Webhook Moneroo avant le parseur JSON pour conserver le corps brut.
  app.post("/api/webhooks/moneroo", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ""));
      if (!verifyMonerooSignature(raw, req.headers["x-moneroo-signature"] as string | undefined)) {
        res.status(401).json({ error: "signature invalide" });
        return;
      }
      const event = JSON.parse(raw.toString("utf8") || "{}");
      const paymentId = extractSucceededPaymentId(event);
      if (paymentId) {
        const db = await getDb();
        if (db) await markOnlinePaymentSucceeded(db, paymentId, String(event.data?.id ?? "webhook"));
      }
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Moneroo webhook]", error);
      res.status(200).json({ received: true });
    }
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
