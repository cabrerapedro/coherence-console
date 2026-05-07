import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node scripts/migrate.ts <migration-file.sql>");
    process.exit(1);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const sql = readFileSync(resolve(process.cwd(), file), "utf8");
  const pool = new Pool({ connectionString });
  try {
    await pool.query(sql);
    console.log(`migrate: applied ${file}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
