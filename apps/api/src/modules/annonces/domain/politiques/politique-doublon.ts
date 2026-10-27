export function distanceHamming(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;

  let distance = 0;
  let valeurA = 0n;
  let valeurB = 0n;

  try {
    valeurA = BigInt(`0x${a}`);
    valeurB = BigInt(`0x${b}`);
  } catch {
    return Number.POSITIVE_INFINITY;
  }

  let different = valeurA ^ valeurB;

  while (different > 0n) {
    distance += Number(different & 1n);
    different >>= 1n;
  }

  return distance;
}

export function estDoublonExact(hash: string, hashExistant: string): boolean {
  return hash.toLowerCase() === hashExistant.toLowerCase();
}

export function estQuasiDoublon(
  hash: string,
  hashesDuVendeur: readonly string[],
  seuil = 6,
): boolean {
  return hashesDuVendeur.some(
    (existant) => existant !== hash && distanceHamming(hash, existant) <= seuil,
  );
}
