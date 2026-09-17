import "dotenv/config";
import { createApp } from "./app.js";

const PORT = 3000;
const app = createApp();

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
