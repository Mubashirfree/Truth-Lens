import { PrismaClient } from "../generated/client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const createPrismaClient = () => {
  const bundledDbPath = path.resolve(process.cwd(), "prisma/dev.db");
  const tmpDbPath = "/tmp/dev.db";

  const tmpDir = path.dirname(tmpDbPath);
  if (!fs.existsSync(tmpDir)) {
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create temporary directory:", err);
    }
  }

  if (!fs.existsSync(tmpDbPath)) {
    console.log(`Copying template SQLite database from ${bundledDbPath} to ${tmpDbPath}`);
    try {
      if (fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, tmpDbPath);
        console.log("Database copied successfully to /tmp.");
      } else {
        console.warn("Template database file not found in build directory. Creating new database at /tmp.");
      }
    } catch (err) {
      console.error("Failed to copy SQLite database to /tmp:", err);
    }
  }

  const adapter = new PrismaBetterSqlite3({
    url: "file:" + tmpDbPath,
  });
  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
