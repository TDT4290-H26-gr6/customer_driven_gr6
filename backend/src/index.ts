import { buildServer } from "./server";
import { config } from "./config";
import { ensureDefaultRoles } from "./modules/identity/roles.bootstrap";

// Idempotent startup data.
ensureDefaultRoles().catch((e) => console.error("ensureDefaultRoles failed:", e));

buildServer().listen(config.port, () => {
  console.log(`AIOS backend listening on http://localhost:${config.port}`);
});
