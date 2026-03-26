import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, placeSnapshots } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(placeSnapshots)
    .where(eq(placeSnapshots.place_id, placeId))
    .orderBy(asc(placeSnapshots.fetched_at));

  return NextResponse.json(rows);
}
