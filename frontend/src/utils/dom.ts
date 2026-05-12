export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string | undefined>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined) node.setAttribute(k, v)
    }
  }
  return node
}

export function append(parent: HTMLElement, ...nodes: (HTMLElement | DocumentFragment)[]) {
  for (const n of nodes) parent.appendChild(n)
}
