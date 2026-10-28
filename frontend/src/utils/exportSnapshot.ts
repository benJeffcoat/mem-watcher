/** Render a frozen copy of the performance view to a locally downloaded PNG. */
export async function exportSnapshot(node: HTMLElement, sessionName: string): Promise<void> {
  const snapshot = node.cloneNode(true) as HTMLElement
  snapshot.classList.add('performance-snapshot--export')
  snapshot.style.width = `${Math.ceil(node.getBoundingClientRect().width) + 48}px`
  snapshot.querySelectorAll('[data-export-exclude]').forEach((element) => element.remove())
  // Limit the exported table while preserving the live table and its row order.
  snapshot.querySelectorAll('.table-card tbody tr:nth-child(n + 11)').forEach((row) => row.remove())

  // Keep the live page unchanged and expand scrollable content only in the copy.
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-100000px'
  container.style.top = '0'
  container.style.pointerEvents = 'none'
  container.append(snapshot)
  document.body.append(container)

  try {
    // SVG descendants keep their CSS inline because the renderer clones SVGs whole.
    snapshot.querySelectorAll<SVGElement>('svg *').forEach((element) => {
      const style = window.getComputedStyle(element)
      for (const property of ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
        'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'font-family',
        'font-size', 'font-weight', 'text-anchor']) {
        element.style.setProperty(property, style.getPropertyValue(property))
      }
    })
    await document.fonts.ready
    const { toBlob } = await import('html-to-image')
    const blob = await toBlob(snapshot, { pixelRatio: 1, backgroundColor: '#1b1f24' })
    if (!blob || blob.size === 0) {
      throw new Error('Could not generate the snapshot image.')
    }

    const name = sessionName.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'session'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mem-watcher-${name}-${timestamp}.png`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } finally {
    container.remove()
  }
}
