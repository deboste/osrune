// Comptage tokens et couts (spec 7.7).
// Estimation locale : ~4 caracteres par token (FR). Le reel API fait foi quand dispo.

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CostInput {
  tokensIn: number;
  tokensOut: number;
  priceInPerM: number;
  priceOutPerM: number;
}

/** Cout en centimes USD. */
export function costCents(c: CostInput): number {
  return (c.tokensIn / 1_000_000) * c.priceInPerM * 100 + (c.tokensOut / 1_000_000) * c.priceOutPerM * 100;
}

export function envPricing(): { priceInPerM: number; priceOutPerM: number } {
  const pin = Number(process.env["PRICE_IN_PER_M"] ?? 0.07);
  const pout = Number(process.env["PRICE_OUT_PER_M"] ?? 0.28);
  return { priceInPerM: pin, priceOutPerM: pout };
}
