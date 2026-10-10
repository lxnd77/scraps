import { createCollabServer, shutdown } from "./server.js";

const port = Number(process.env.PORT ?? 1234);
const server = createCollabServer();

server.listen(port, () => {
  console.log(JSON.stringify({ level: "info", msg: "collab listening", port }));
});

// Hocuspocus arrives in Phase 2; it will flush pending stores here.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(JSON.stringify({ level: "info", msg: "collab shutting down", signal }));
    shutdown(server)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}
