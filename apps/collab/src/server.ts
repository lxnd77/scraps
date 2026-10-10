import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface HealthBody {
  status: "ok";
  service: "scraps-collab";
  uptimeSeconds: number;
}

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? "/";
  if (req.method === "GET" && (url === "/health" || url === "/healthz")) {
    const body: HealthBody = {
      status: "ok",
      service: "scraps-collab",
      uptimeSeconds: Math.round(process.uptime()),
    };
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
}

export function createCollabServer(): Server {
  return createServer(handleRequest);
}

/** Stop accepting connections and resolve once in-flight requests finish. */
export function shutdown(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeIdleConnections();
  });
}
