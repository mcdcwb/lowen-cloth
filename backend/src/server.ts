import "dotenv/config";
import { createApp } from "./app.js";
import { logServerStarted } from "./lib/logger.js";

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
    logServerStarted(PORT);
});
