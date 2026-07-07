// Portado de gi-website-final/src/lib/format.ts
export function formatCount({prefix = '', value, suffix = '', decimals = 0} = {}) {
  const n = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${n}${suffix}`;
}
