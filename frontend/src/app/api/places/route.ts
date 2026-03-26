import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, places } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");

  if (placeId) {
    const rows = await db
      .select()
      .from(places)
      .where(eq(places.place_id, placeId))
      .limit(1);

    return NextResponse.json(rows[0] ?? null);
  }

  const rows = await db.select().from(places).orderBy(asc(places.created_at));

  return NextResponse.json(rows);
}
