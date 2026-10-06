const formatters = new Map<number, Intl.NumberFormat>();

/** Número con coma decimal (es-CO), igual en tarjetas, gráficos y desgloses. */
export function formatNumber(value: number, decimals = 1): string {
  let formatter = formatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, formatter);
  }
  return formatter.format(value);
}
