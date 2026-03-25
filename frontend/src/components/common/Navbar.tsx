"use client";

import Link from "next/link";
import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { shortenAddress } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Places" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/how-it-works", label: "How It Works" },
] as const;

const navLinkClass =
  "border-2 border-transparent px-1 py-2 font-body text-sm font-semibold hover:underline md:px-0 md:py-0";

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function NavbarWallet({
  initiaAddress,
  username,
  openConnect,
  openWallet,
}: {
  initiaAddress: string | undefined;
  username: string | null | undefined;
  openConnect: () => void;
  openWallet: () => void;
}) {
  const btnBase =
    "shrink-0 border-2 border-border font-body text-sm font-bold shadow-neo-sm transition-all hover:neo-press px-3 py-1.5 md:px-4 md:py-2";

  if (initiaAddress) {
    return (
      <button
        type="button"
        onClick={openWallet}
        className={`${btnBase} flex max-w-[11rem] items-center gap-2 bg-main md:max-w-none`}
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
        <span className="truncate">
          {username ? username : shortenAddress(initiaAddress)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openConnect}
      className={`${btnBase} bg-primary text-primary-foreground`}
    >
      <span className="md:hidden">Connect</span>
      <span className="hidden md:inline">Connect Wallet</span>
    </button>
  );
}

export default function Navbar() {
  const { initiaAddress, username, openConnect, openWallet } =
    useInterwovenKit();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const walletProps = {
    initiaAddress,
    username,
    openConnect,
    openWallet,
  };

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 md:gap-4 md:px-4 md:py-3">
        <Link
          href="/"
          className="min-w-0 truncate font-heading text-xl font-extrabold md:text-2xl"
          onClick={closeMobile}
        >
          📍 PINITIA
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link key={href} href={href} className={navLinkClass}>
              {label}
            </Link>
          ))}
          <NavbarWallet {...walletProps} />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <NavbarWallet {...walletProps} />
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-border bg-background shadow-neo-sm transition-all hover:neo-press"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={`border-t-2 border-border bg-background md:hidden ${mobileOpen ? "block" : "hidden"}`}
      >
        <div className="flex flex-col px-3 pb-3 pt-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={navLinkClass}
              onClick={closeMobile}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
