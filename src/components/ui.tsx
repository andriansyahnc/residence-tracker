import { Link } from '@tanstack/react-router'
import type { ProblemStatus } from '../domain/types'

const STATUS_LABELS: Record<ProblemStatus, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
}

const STATUS_CLASS: Record<ProblemStatus, string> = {
  submitted: 'auralis-status-submitted',
  acknowledged: 'auralis-status-acknowledged',
  in_progress: 'auralis-status-in_progress',
  resolved: 'auralis-status-resolved',
  closed: 'auralis-status-closed',
  rejected: 'auralis-status-rejected',
}

export function StatusBadge({ status }: { status: ProblemStatus }) {
  return (
    <span className={`auralis-chip ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function formatRelativeTime(iso: string) {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function AppShell({
  title,
  subtitle,
  role,
  children,
  action,
}: {
  title: string
  subtitle?: string
  role?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="auralis-bg mx-auto min-h-[calc(100vh-8rem)] max-w-lg px-4 py-4">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[var(--text-primary)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
          ) : null}
          {role ? (
            <span className="auralis-chip auralis-chip-role mt-2">{role}</span>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="auralis-empty">{message}</div>
}

export function PrimaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`auralis-btn-primary ${className}`} {...props}>
      {children}
    </button>
  )
}

export function TextField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-2">
      <span className="auralis-label">{label}</span>
      <input className="auralis-input" {...props} />
    </label>
  )
}

export function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block space-y-2">
      <span className="auralis-label">{label}</span>
      <textarea className="auralis-input min-h-28 resize-y" {...props} />
    </label>
  )
}

export function ProblemListItem({
  id,
  title,
  status,
  updatedAt,
  meta,
}: {
  id: string
  title: string
  status: ProblemStatus
  updatedAt: string
  meta?: string
}) {
  return (
    <Link
      to="/problems/$problemId"
      params={{ problemId: id }}
      className="auralis-list-item"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge status={status} />
        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
          {formatRelativeTime(updatedAt)}
        </span>
      </div>
      <p className="m-0 font-medium text-[var(--text-primary)]">{title}</p>
      {meta ? (
        <p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">{meta}</p>
      ) : null}
    </Link>
  )
}

export const FILTER_STATUSES: Array<ProblemStatus | 'all'> = [
  'all',
  'submitted',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
]
