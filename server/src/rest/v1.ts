import express, { type Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { db } from "../db/index.js";
import { appRouter } from "../routers/index.js";
import { settlementOrders } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";
import { resolveApiKey } from "../services/api-keys.js";
import type { DinoTier } from "../services/dino-balance.js";

/**
 * Per-tier rate limits (req/min). Tier 0 is the anon / no-key path
 * and keeps the previous 60/min bar. Higher tiers unlock proportional
 * multipliers so real integrations have headroom without us having
 * to negotiate paid plans per consumer.
 */
const TIER_LIMITS: Record<0 | 1 | 2 | 3, number> = {
  0: 60,
  1: 300,
  2: 1200,
  3: 3000,
};

interface TieredRequest extends Request {
  apiTier?: DinoTier;
  apiKeyId?: number;
  apiKeyOwner?: string;
}

/**
 * Public unauthed REST gateway. Thin adapters over the existing tRPC
 * routers — every handler creates a caller with an anonymous context
 * (no wallet auth headers), invokes the corresponding procedure, and
 * returns JSON. No new business logic lives here; if a tRPC route
 * changes, the REST response moves with it.
 *
 * Every endpoint is:
 *   - unauthenticated
 *   - CORS-open (read-only reads are safe to serve to any origin)
 *   - rate-limited to 60 req/min/IP
 *   - cacheable (Cache-Control: public, max-age=60, s-maxage=300)
 *
 * Paths live under /api/v1/. Sibling JSON + docs route a hand-written
 * OpenAPI 3.0 spec and a Scalar-rendered documentation UI.
 */

const publicCors = cors({
  origin: "*",
  methods: ["GET", "HEAD", "OPTIONS"],
  optionsSuccessStatus: 204,
});

/**
 * Authorization-header middleware. Runs before the rate limiter so
 * the limiter can see the caller's tier. Tolerates missing /
 * malformed / revoked keys by falling through to the anon path —
 * the REST gateway is explicitly public-read, a bad key is just
 * a missed-upgrade, not an error.
 */
async function attachTier(
  req: TieredRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.header("authorization");
  if (!auth) return next();
  const match = auth.match(/^Bearer\s+(dino_live_[A-Za-z0-9_-]+)$/);
  if (!match) return next();
  try {
    const resolved = await resolveApiKey(match[1]);
    if (resolved) {
      req.apiTier = resolved.tier;
      req.apiKeyId = resolved.key.id;
      req.apiKeyOwner = resolved.key.ownerWallet;
    }
  } catch {
    /* swallow; fall through to anon */
  }
  next();
}

/**
 * Tier-aware limiter. Bucket key is the API key id when present, IP
 * otherwise — so a single key with the Gold tier multiplier gets
 * 3000 req/min across all of that integrator's consumers, while
 * anonymous IPs still cap at 60/min each.
 */
const PUBLIC_RATE = rateLimit({
  windowMs: 60_000,
  limit: (req: TieredRequest) => {
    const id = (req.apiTier?.id ?? 0) as 0 | 1 | 2 | 3;
    return TIER_LIMITS[id];
  },
  keyGenerator: (req: TieredRequest) => {
    return req.apiKeyId ? `key:${req.apiKeyId}` : `ip:${req.ip ?? "unknown"}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function setCache(res: Response) {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
}

function anonCaller() {
  return appRouter.createCaller({
    db,
    walletAddress: undefined,
    walletSignature: undefined,
    walletTimestamp: undefined,
  });
}

async function wrap(
  res: Response,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    const result = await fn();
    setCache(res);
    res.json(result);
  } catch (err: any) {
    const status =
      err?.data?.httpStatus ??
      (err?.message?.includes("not found") ? 404 : 500);
    res.status(status).json({
      error: err?.message ?? "internal error",
    });
  }
}

export function mountRestV1(app: express.Express): Router {
  const r = express.Router();
  r.use(publicCors);
  r.use(attachTier);
  r.use(PUBLIC_RATE);

  r.get("/series", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const type = req.query.type as "Equity" | "Debt" | "Fund" | "LLC" | undefined;
    const jurisdiction = req.query.jurisdiction as string | undefined;
    const status = req.query.status as "active" | "paused" | "pending" | undefined;
    await wrap(res, () =>
      anonCaller().securities.list({ page, limit, type, jurisdiction, status }),
    );
  });

  r.get("/series/:mint", async (req, res) => {
    await wrap(res, () => anonCaller().securities.getByMint({ mint: req.params.mint }));
  });

  r.get("/series/:mint/holders/stats", async (req, res) => {
    await wrap(res, () => anonCaller().holders.stats({ mint: req.params.mint }));
  });

  // Settlements.getMySettlements is wallet-scoped; the public feed here is
  // the recent cross-platform settlement history pulled from the indexed
  // settlement_orders table directly. Stays anonymized — wallet pubkeys
  // are on-chain public data but we still omit anything beyond what's
  // already displayed on /settlement.
  r.get("/settlements/recent", async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    try {
      const rows = await db
        .select()
        .from(settlementOrders)
        .where(eq(settlementOrders.status, "settled"))
        .orderBy(desc(settlementOrders.settledAt))
        .limit(limit);
      setCache(res);
      res.json({
        items: rows.map((r) => ({
          orderId: r.orderId,
          buyer: r.buyer,
          seller: r.seller,
          securityMint: r.securityMint,
          tokenAmount: Number(r.tokenAmount),
          usdcAmount: Number(r.usdcAmount),
          txSignature: r.txSignature,
          finalityMs: r.finalityMs,
          feeLamports: r.feeLamports !== null ? Number(r.feeLamports) : null,
          settledAt: r.settledAt?.toISOString() ?? null,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "internal error" });
    }
  });

  r.get("/compliance/simulate", async (req, res) => {
    const wallet = req.query.wallet as string | undefined;
    const mint = req.query.mint as string | undefined;
    if (!wallet || !mint) {
      return res.status(400).json({ error: "wallet and mint query params required" });
    }
    await wrap(res, () => anonCaller().compliance.simulate({ wallet, mint }));
  });

  r.get("/openapi.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    setCache(res);
    res.send(openApiJson());
  });

  r.get("/docs", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(scalarHtml());
  });

  app.use("/api/v1", r);
  return r;
}

function openApiJson(): string {
  return JSON.stringify(OPENAPI_SPEC, null, 2);
}

const OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "DinoSecurities Public API",
    version: "1.1.0",
    description:
      "Public read-only gateway into the DinoSecurities platform. Wraps the same indexed data the official UI and tRPC surface use.\n\n**Rate limits (req/min):** 60 anonymous, 300 Bronze, 1200 Silver, 3000 Gold — tier is resolved from the live $DINO balance of the wallet attached to your API key. Generate a key at `/app/dino`. Send it as `Authorization: Bearer dino_live_…`. Cacheable 60s at the edge, 300s at the CDN.",
  },
  servers: [{ url: "/api/v1", description: "Production" }],
  security: [{}, { DinoKey: [] }],
  paths: {
    "/series": {
      get: {
        summary: "List security series",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "type", in: "query", schema: { type: "string", enum: ["Equity", "Debt", "Fund", "LLC"] } },
          { name: "jurisdiction", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "paused", "pending"] } },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/Series" } },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/series/{mint}": {
      get: {
        summary: "Get a single series by mint address",
        parameters: [
          { name: "mint", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Series",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Series" } } },
          },
          "404": { description: "Not found" },
        },
      },
    },
    "/series/{mint}/holders/stats": {
      get: {
        summary: "Anonymized holder statistics for a series",
        parameters: [
          { name: "mint", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Holder counts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalHolders: { type: "integer" },
                    accreditedHolders: { type: "integer" },
                    frozenHolders: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/settlements/recent": {
      get: {
        summary: "Most recent settled DvP orders across all series",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        ],
        responses: {
          "200": {
            description: "Settled orders",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/SettledOrder" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/compliance/simulate": {
      get: {
        summary: "Off-chain read-only simulation of the Transfer Hook checks",
        description:
          "Runs the same validation sequence dino_transfer_hook runs on every transfer — KYC, accreditation, freeze status, jurisdiction — without submitting a transaction. Reproducible from public on-chain state alone.",
        parameters: [
          { name: "wallet", in: "query", required: true, schema: { type: "string" } },
          { name: "mint", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Step-by-step pass/fail breakdown",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    overall: { type: "string", enum: ["pass", "fail"] },
                    checks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          status: { type: "string", enum: ["pass", "fail", "skip"] },
                          detail: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "wallet and mint query params required" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      DinoKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "dino_live_*",
        description:
          "Optional. Present an API key to lift the default 60 req/min IP-based rate limit to your $DINO tier: Bronze 300/min, Silver 1200/min, Gold 3000/min. Tier is read live from the key owner's $DINO balance.",
      },
    },
    schemas: {
      Series: {
        type: "object",
        properties: {
          mintAddress: { type: "string" },
          issuer: { type: "string" },
          name: { type: "string" },
          symbol: { type: "string" },
          securityType: { type: "string" },
          docHash: { type: "string" },
          docUri: { type: "string" },
          isin: { type: "string", nullable: true },
          maxSupply: { type: "integer", format: "int64" },
          currentSupply: { type: "integer", format: "int64" },
          transferRestrictions: { type: "string" },
          jurisdiction: { type: "string" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      SettledOrder: {
        type: "object",
        properties: {
          orderId: { type: "string" },
          buyer: { type: "string", nullable: true },
          seller: { type: "string", nullable: true },
          securityMint: { type: "string" },
          tokenAmount: { type: "integer" },
          usdcAmount: { type: "integer" },
          txSignature: { type: "string", nullable: true },
          finalityMs: { type: "integer", nullable: true },
          feeLamports: { type: "integer", nullable: true },
          settledAt: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
} as const;

function scalarHtml(): string {
  // Scalar's standalone CDN build renders a full docs UI from a single
  // script tag pointed at the OpenAPI JSON URL. No local assets, no
  // build step. Works offline for the JSON once it's been fetched.
  return `<!doctype html>
<html>
  <head>
    <title>DinoSecurities API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/v1/openapi.json"
      data-configuration='{"theme":"kepler"}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
}
