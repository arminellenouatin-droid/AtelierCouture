import "dotenv/config";
import { createServer } from "http";
import net from "net";
import { createApplication } from "./app";
import { migrateDatabase } from "../db";
import { seedIfEmpty } from "../seed";
import { serveStatic } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await migrateDatabase();
  await seedIfEmpty();

  const app = createApplication();
  const server = createServer(app);

  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api") && !/\.[a-zA-Z0-9]+$/.test(req.path)) {
      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.setHeader("X-App-Version", "2.1");
    }
    next();
  });

  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error("[Server] Démarrage impossible", error);
  process.exitCode = 1;
});
