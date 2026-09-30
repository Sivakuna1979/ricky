export const formatShare = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—')
