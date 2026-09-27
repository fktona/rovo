import { Hono } from "hono";

// Ponder reserves /health, /ready, /status, and /metrics. The Rovo API
// remains in apps/api; this endpoint module satisfies Ponder's required API
// entrypoint without exposing another, divergent launch endpoint.
const app = new Hono();

export default app;
