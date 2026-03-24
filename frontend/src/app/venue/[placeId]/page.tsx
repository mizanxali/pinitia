import VenueDetail from "@/components/Venue/VenueDetail";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = await params;
  return <VenueDetail placeId={placeId} />;
}
