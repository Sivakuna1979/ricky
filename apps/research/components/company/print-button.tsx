'use client'

import type { ReactNode } from 'react'

/** v1 export: the browser's print-to-PDF with a print stylesheet. Server-side PDF generation is planned (see docs). */
export function PrintButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      {children}
    </button>
  )
}
