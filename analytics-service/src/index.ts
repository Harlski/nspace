import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startAnalyticsService } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env"), override: true });

startAnalyticsService();
