import MarketDetail from "@/components/MarketDetail";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return <MarketDetail address={address} />;
}
