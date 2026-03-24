"use client";

import Link from "next/link";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { shortenAddress } from "@/lib/utils";

export default function Navbar() {
  const { initiaAddress, openConnect, openWallet } = useInterwovenKit();

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-heading text-2xl font-extrabold">
          📍 PINITIA
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-body text-sm font-semibold hover:underline"
          >
            Venues
          </Link>
          <Link
            href="/portfolio"
            className="font-body text-sm font-semibold hover:underline"
          >
            Portfolio
          </Link>
          <Link
            href="/leaderboard"
            className="font-body text-sm font-semibold hover:underline"
          >
            Leaderboard
          </Link>

          {initiaAddress ? (
            <button
              type="button"
              onClick={openWallet}
              className="flex items-center gap-2 border-2 border-border bg-main px-4 py-2 font-body text-sm font-bold shadow-neo-sm transition-all hover:neo-press"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              {shortenAddress(initiaAddress)}
            </button>
          ) : (
            <button
              type="button"
              onClick={openConnect}
              className="border-2 border-border bg-primary px-4 py-2 font-body text-sm font-bold text-primary-foreground shadow-neo-sm transition-all hover:neo-press"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
