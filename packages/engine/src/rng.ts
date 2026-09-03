// Generateur pseudo-aleatoire deterministe (mulberry32).
// L'etat complet tient dans un uint32 stocke dans WorldState.rng.
// Aucun Math.random, aucun Date.now ici.

export function normalizeSeed(seed: number): number {
  return (seed >>> 0) || 0x9e3779b9;
}

export function nextRng(rng: number): { value: number; rng: number } {
  let s = (rng + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: s };
}

export class Rng {
  state: number;
  constructor(seed: number) {
    this.state = normalizeSeed(seed);
  }
  next(): number {
    const r = nextRng(this.state);
    this.state = r.rng;
    return r.value;
  }
  int(min: number, max: number): number {
    // [min, max] inclus
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick on empty array");
    const i = Math.floor(this.next() * arr.length);
    return arr[i] as T;
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i] as T;
      a[i] = a[j] as T;
      a[j] = t;
    }
    return a;
  }
}
