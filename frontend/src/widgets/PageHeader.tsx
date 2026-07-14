export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string
  title: string
  actions?: React.ReactNode
}) {
  return (
    <section className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {actions ? <div className="hero-metrics">{actions}</div> : null}
    </section>
  )
}
