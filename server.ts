import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { handleUpgrade, getOrCreateWSS } from "./src/lib/wsServer";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, port, dir: process.cwd() });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // Ensure WSS is ready
  getOrCreateWSS();

  // Only intercept our dedicated radar WebSocket endpoint
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "/", false);
    if (pathname === "/api/radar/ws" || pathname === "/ws") {
      handleUpgrade(req, socket as import("net").Socket, head);
    }
    // Note: Do not destroy other upgrade requests so Next.js internal HMR can function
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`> Server ready on http://localhost:${port} and http://127.0.0.1:${port}`);
    console.log(`> WebSocket stream on ws://localhost:${port}/api/radar/ws`);
  });
});
