import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { places, placeSnapshots } from "./schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client);

export { places, placeSnapshots };
