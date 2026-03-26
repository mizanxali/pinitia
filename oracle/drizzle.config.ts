/// <reference types="node" />
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/utils/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
