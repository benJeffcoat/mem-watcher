function iconProps(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
}

export function ExportIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}

export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

export function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="4" rx="1.5" />
      <rect x="13" y="10" width="7" height="10" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function SessionsIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M8 7a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z" />
      <path d="M16 9a2 2 0 1 0 0 4a2 2 0 0 0 0-4Z" />
      <path d="M3.5 19c.8-2.5 3-4 5.7-4c2.8 0 4.8 1.5 5.5 4" />
      <path d="M14 18.5c.4-1.6 1.8-2.7 3.6-2.7c1.4 0 2.6.7 3.2 1.9" />
    </svg>
  )
}

export function PerformanceIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 19h16" />
      <path d="M7 15l3-3l3 2l4-5" />
      <path d="M17 9h2v2" />
    </svg>
  )
}

export function LogsIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M7 4.5h10l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 6 19V6a1.5 1.5 0 0 1 1-1.5Z" />
      <path d="M14 4.5V8h6" />
      <path d="M9 12h8" />
      <path d="M9 16h8" />
    </svg>
  )
}

export function LoadIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function EditIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" />
      <path d="m13.5 7.5 3 3" />
    </svg>
  )
}

export function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7v12" />
      <path d="M16 7v12" />
      <path d="M6 7l1 13h10l1-13" />
    </svg>
  )
}

export function ViewIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function DisconnectIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M9 4.5h-2a2.5 2.5 0 0 0-2.5 2.5v10A2.5 2.5 0 0 0 7 19.5h2" />
      <path d="M13 8.5 18 12l-5 3.5" />
      <path d="M18 12H9" />
    </svg>
  )
}

export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="9" y="9" width="10" height="11" rx="1.5" />
      <path d="M6 15H5a1 1 0 0 1-1-1V5.5A1.5 1.5 0 0 1 5.5 4H14a1 1 0 0 1 1 1v1" />
    </svg>
  )
}

export function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M7.5 9A6.5 6.5 0 0 1 18 11" />
      <path d="M16.5 15A6.5 6.5 0 0 1 6 13" />
    </svg>
  )
}
