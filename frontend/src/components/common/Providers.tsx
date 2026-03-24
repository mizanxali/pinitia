"use client";

import { pinitiaChain } from "@/lib/chain";
import { CHAIN_ID } from "@/lib/contracts";
import {
  InterwovenKitProvider,
  TESTNET,
  injectStyles,
} from "@initia/interwovenkit-react";
import "@initia/interwovenkit-react/styles.css";
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useEffect } from "react";

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Inject styles into the shadow DOM used by Initia Wallet
    injectStyles(InterwovenKitStyles);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={CHAIN_ID}
          customChain={pinitiaChain}
        >
          {children}
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
