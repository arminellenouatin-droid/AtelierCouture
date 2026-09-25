import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import serverless from "serverless-http";
import { createApplication } from "../../server/_core/app";
import { migrateDatabase } from "../../server/db";
import { seedIfEmpty } from "../../server/seed";

const app = createApplication();
const expressHandler = serverless(app);
let initialization: Promise<void> | undefined;

async function ensureInitialized(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      await migrateDatabase();
      await seedIfEmpty();
    })();
  }
  await initialization;
}

export async function handler(event: APIGatewayProxyEvent, context: Context) {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    await ensureInitialized();
    return await expressHandler(event, context);
  } catch (error) {
    console.error("[Netlify API] Initialisation ou requête impossible", error);
    return {
      statusCode: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Service momentanément indisponible" }),
    };
  }
}
