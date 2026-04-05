import MarketDetail from "@/components/Market/MarketDetail";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MarketDetail marketId={Number(id)} />;
}
