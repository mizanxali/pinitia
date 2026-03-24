"use client";

import { useParams } from "next/navigation";
import { usePlaceMarkets } from "@/hooks/useMarkets";
import { useSnapshotHistory } from "@/hooks/useSnapshotHistory";
import { CURATED_VENUES } from "@/lib/venues";
import MarketCard from "@/components/MarketCard";
import SnapshotChart from "@/components/SnapshotChart";
import Link from "next/link";
import { useState } from "react";

export default function VenuePage() {
  const { placeId } = useParams<{ placeId: string }>();
  const decodedPlaceId = decodeURIComponent(placeId);
  const { data: markets, isLoading: marketsLoading } =
    usePlaceMarkets(decodedPlaceId);
  const { data: snapshots } = useSnapshotHistory(decodedPlaceId);
  const [tab, setTab] = useState<"overview" | "markets" | "history">(
    "overview",
  );

  const venue = CURATED_VENUES.find((v) => v.placeId === decodedPlaceId);
  const latestSnapshot = snapshots?.at(-1);

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-block font-body text-sm font-bold text-muted-foreground hover:underline"
      >
        &larr; Back to venues
      </Link>

      <div className="mb-6 border-2 border-border bg-card p-6 shadow-neo">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center border-2 border-border bg-main">
            <span className="text-3xl">📍</span>
          </div>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">
              {venue?.name ?? decodedPlaceId}
            </h1>
            {venue?.address && (
              <p className="mt-1 font-body text-sm text-muted-foreground">
                {venue.address}
              </p>
            )}
            {latestSnapshot && (
              <div className="mt-2 flex gap-3">
                <span className="border-2 border-border bg-secondary px-2 py-0.5 text-xs font-bold">
                  Rating: {latestSnapshot.rating}
                </span>
                <span className="border-2 border-border bg-secondary px-2 py-0.5 text-xs font-bold">
                  Reviews: {latestSnapshot.review_count}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-2 border-border">
        {(["overview", "markets", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2 font-body text-sm font-bold transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            } ${t !== "overview" ? "border-l-2 border-border" : ""}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 font-heading text-xl font-extrabold">
              Rating History
            </h2>
            <SnapshotChart snapshots={snapshots ?? []} metric="rating" />
          </div>
          <div>
            <h2 className="mb-3 font-heading text-xl font-extrabold">
              Review Count History
            </h2>
            <SnapshotChart snapshots={snapshots ?? []} metric="review_count" />
          </div>
        </div>
      )}

      {tab === "markets" && (
        <div>
          <h2 className="mb-3 font-heading text-xl font-extrabold">
            Active Markets
          </h2>
          {marketsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse border-2 border-border bg-muted"
                />
              ))}
            </div>
          ) : markets?.length === 0 ? (
            <div className="border-2 border-border bg-muted p-6 text-center font-body text-sm font-bold text-muted-foreground">
              No markets for this venue yet
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {markets?.map((m) => (
                <MarketCard key={m.address} market={m} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div>
          <h2 className="mb-3 font-heading text-xl font-extrabold">
            Snapshot History
          </h2>
          {!snapshots || snapshots.length === 0 ? (
            <div className="border-2 border-border bg-muted p-6 text-center font-body text-sm font-bold text-muted-foreground">
              No snapshot data available
            </div>
          ) : (
            <div className="border-2 border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border bg-main">
                    <th className="px-4 py-2 text-left font-heading text-xs font-extrabold">
                      Date
                    </th>
                    <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                      Rating
                    </th>
                    <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                      Reviews
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshots].reverse().map((s, i) => (
                    <tr
                      key={s.id}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    >
                      <td className="px-4 py-2 font-body text-xs font-semibold">
                        {new Date(s.fetched_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-body text-xs font-bold">
                        {s.rating}
                      </td>
                      <td className="px-4 py-2 text-right font-body text-xs font-bold">
                        {s.review_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
