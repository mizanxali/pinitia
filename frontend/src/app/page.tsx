import VenueGrid from "@/components/Home/VenueGrid";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-4xl font-extrabold">
          Prediction Markets on Places
        </h1>
        <p className="mt-2 font-body text-lg text-muted-foreground">
          Go LONG or SHORT on Google Maps ratings of your favorite places.
          Winners split the losers&apos; pool.
        </p>
      </div>

      <VenueGrid />
    </div>
  );
}
