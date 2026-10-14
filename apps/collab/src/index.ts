import { createTokenVerifier } from "./auth.js";
import { loadConfig } from "./config.js";
import { createSupabaseExporter } from "./export.js";
import { initMonitoring } from "./monitoring.js";
import { createCollabServer } from "./server.js";
import { SupabaseNoteStore } from "./store.js";

const report = initMonitoring(process.env.SENTRY_DSN);
const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify(entry));
  report(entry);
};

const config = loadConfig();
const server = createCollabServer({
  verifyToken: createTokenVerifier({
    jwksUrl: config.jwksUrl,
    jwtSecret: config.SUPABASE_JWT_SECRET,
  }),
  store: new SupabaseNoteStore(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY),
  exporter: createSupabaseExporter(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY),
  internalSecret: config.INTERNAL_SECRET,
  allowedOrigins: config.ALLOWED_ORIGINS,
  debounceMs: config.DEBOUNCE_MS,
  maxDebounceMs: config.MAX_DEBOUNCE_MS,
  previewIntervalMs: config.PREVIEW_INTERVAL_MS,
  log,
});

await server.listen(config.PORT);
log({ level: "info", msg: "collab listening", port: config.PORT });

// destroy() flushes every pending debounced store before the process exits
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    log({ level: "info", msg: "collab shutting down", signal });
    server
      .destroy()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}
