import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
// Run from backend. A fresh database keeps seed/integration tests away from real carts.
const database = "lowen_test_" + randomUUID().replaceAll("-", "");
const url = new URL(process.env.DATABASE_URL);
const admin = new pg.Client({ connectionString: url.toString() });
await admin.connect();
const run = (args, cwd = process.cwd(), env = process.env) => new Promise((resolveRun, reject) => {
  const child = spawn(process.execPath, args, { cwd, env, stdio: "inherit", windowsHide: true });
  child.once("error", reject); child.once("exit", code => code === 0 ? resolveRun() : reject(new Error(`Command failed (${code}): ${args.join(" ")}`)));
});
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  url.pathname = "/" + database;
  const env = { ...process.env, DATABASE_URL: url.toString() };
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"], process.cwd(), env);
  if (process.argv[2] === "browser") {
    await run(["--import", "tsx", "--input-type=module", "-e", "const {seedDevelopmentProducts}=await import('./src/lib/development-products.ts'); const {prisma}=await import('./src/lib/prisma.ts'); try { await seedDevelopmentProducts(); } finally { await prisma.$disconnect(); }"], process.cwd(), env);
    await run([resolve("../node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(3)], resolve(".."), env);
  } else {
    const files = (await readdir("tests")).filter(f => f.endsWith(".test.ts")).map(f => "tests/" + f);
    await run(["--import", "tsx", "--test", ...files], process.cwd(), env);
  }
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin.end();
}
