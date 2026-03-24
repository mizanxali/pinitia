import VenueGrid from "@/components/VenueGrid";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-4xl font-extrabold">
          Prediction Markets on Places
        </h1>
        <p className="mt-2 font-body text-lg text-muted-foreground">
          Bet LONG or SHORT on Google Maps venue metrics. Winners split the
          losers&apos; pool.
        </p>
      </div>

      <VenueGrid />
    </div>
  );
}
