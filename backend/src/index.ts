import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { questionsRouter } from "./routes/questions";
import { authRouter } from "./routes/auth";
import { rolesRouter } from "./routes/roles";
import { ensureDefaultRoles } from "./roles";

const app = express();
const port = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 4000;

app.use(cors());
app.use(express.json());
app.use(healthRouter);
app.use(questionsRouter);
app.use(authRouter);
app.use(rolesRouter);

ensureDefaultRoles().catch((e) => console.error("ensureDefaultRoles failed:", e));

app.listen(port, () => {
  console.log(`AIOS backend listening on http://localhost:${port}`);
});
