export function redactPurchasePrice(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPurchasePrice);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'purchasePrice')
      .map(([key, item]) => [key, redactPurchasePrice(item)]),
  );
}
