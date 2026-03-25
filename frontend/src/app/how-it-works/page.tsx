import { CHAIN_ID } from "@/lib/contracts";

export default function HowItWorksPage() {
  const steps = [
    {
      number: "01",
      title: "Browse Places",
      description:
        "Explore curated Google Maps places - restaurants, cafes, landmarks, and more. Each place shows its current rating, review count, and active prediction markets.",
      color: "bg-primary",
    },
    {
      number: "02",
      title: "Pick a Market",
      description:
        "Each place can have markets on two types of predictions: will the review count hit a target (Velocity), or will the rating reach a certain level (Rating)? Every market has a resolve date.",
      color: "bg-secondary",
    },
    {
      number: "03",
      title: "Bet YES or NO",
      description:
        "Think the target will be hit? Bet YES. Think it won't? Bet NO. Place your bet with GAS tokens - the more your conviction, the bigger the position.",
      color: "bg-main",
    },
    {
      number: "04",
      title: "Oracle Resolves",
      description:
        "An automated oracle fetches live data from the Google Places API. On the resolve date, it posts the final rating and review count on-chain, settling the market.",
      color: "bg-accent",
    },
    {
      number: "05",
      title: "Winners Claim",
      description:
        "Binary parimutuel payout - winners split the losers' pool minus a 2% protocol fee. Claim your winnings directly from the smart contract.",
      color: "bg-primary",
    },
  ];

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-heading text-4xl font-extrabold">How It Works</h1>
        <p className="mt-2 font-body text-lg text-muted-foreground">
          Prediction markets on real-world places, powered by Google Maps data
          and settled on-chain.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-0 md:gap-10">
        <div className="space-y-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex gap-6 border-2 border-border bg-card p-6 shadow-neo"
            >
              <div
                className={`flex p-2 items-center justify-center border-2 border-border ${step.color} font-heading text-xl font-extrabold shadow-neo-sm`}
              >
                {step.number}
              </div>
              <div>
                <h2 className="font-heading text-xl font-extrabold">
                  {step.title}
                </h2>
                <p className="mt-1 font-body text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 md:mt-0 grid grid-cols-1 gap-6">
          <div className="border-2 border-border bg-card p-6 shadow-neo">
            <h3 className="font-heading text-lg font-extrabold">
              Market Types
            </h3>
            <ul className="mt-3 space-y-3 font-body text-sm">
              <li className="flex items-start gap-2">
                <span
                  className={`border-2 border-border px-2 py-0.5 text-xs font-bold bg-blue-300`}
                >
                  VEL
                </span>
                <span>
                  <strong>Velocity</strong> - Will the place gain a target
                  number of new reviews by the resolve date?
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  className={`border-2 border-border px-2 py-0.5 text-xs font-bold bg-purple-300`}
                >
                  RAT
                </span>
                <span>
                  <strong>Rating</strong> - Will the place&apos;s rating reach a
                  target value by the resolve date?
                </span>
              </li>
            </ul>
          </div>

          <div className="border-2 border-border bg-card p-6 shadow-neo">
            <h3 className="font-heading text-lg font-extrabold">Key Details</h3>
            <ul className="mt-3 space-y-2 font-body text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Bets:</strong> Native GAS
                token
              </li>
              <li>
                <strong className="text-foreground">Payout:</strong> Binary
                parimutuel - winners split losers&apos; pool
              </li>
              <li>
                <strong className="text-foreground">Fee:</strong> 2% protocol
                fee on winnings
              </li>
              <li>
                <strong className="text-foreground">Oracle:</strong> Google
                Places API, posted on-chain hourly
              </li>
              <li>
                <strong className="text-foreground">Chain:</strong> Initia EVM
                appchain (Minitia)
              </li>
              <li>
                <strong className="text-foreground">Chain ID:</strong>{" "}
                {CHAIN_ID}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
