import { router } from "../trpc.js";
import { securitiesRouter } from "./securities.js";
import { holdersRouter } from "./holders.js";
import { settlementsRouter } from "./settlements.js";
import { kycRouter } from "./kyc.js";
import { governanceRouter } from "./governance.js";
import { documentsRouter } from "./documents.js";
import { analyticsRouter } from "./analytics.js";
import { complianceRouter } from "./compliance.js";
import { sanctionsRouter } from "./compliance-sanctions.js";
import { webhooksRouter } from "./webhooks.js";
import { xrplCredentialsRouter } from "./xrpl-credentials.js";
import { adminRouter } from "./admin.js";

export const appRouter = router({
  securities: securitiesRouter,
  holders: holdersRouter,
  settlements: settlementsRouter,
  kyc: kycRouter,
  governance: governanceRouter,
  documents: documentsRouter,
  analytics: analyticsRouter,
  compliance: complianceRouter,
  sanctions: sanctionsRouter,
  webhooks: webhooksRouter,
  xrplCredentials: xrplCredentialsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
