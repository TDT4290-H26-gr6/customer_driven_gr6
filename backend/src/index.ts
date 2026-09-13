import { buildServer } from "./server";
import { config } from "./config";
import { ensureDefaultRoles } from "./modules/identity/roles.bootstrap";
import { ensureSeedCourses } from "./modules/courses/courses.bootstrap";

// Idempotent startup data.
ensureDefaultRoles().catch((e) => console.error("ensureDefaultRoles failed:", e));
ensureSeedCourses().catch((e) => console.error("ensureSeedCourses failed:", e));

buildServer().listen(config.port, () => {
  console.log(`AIOS backend listening on http://localhost:${config.port}`);
});
