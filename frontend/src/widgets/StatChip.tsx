export function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
