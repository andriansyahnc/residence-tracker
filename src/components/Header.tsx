import { Link } from '@tanstack/react-router'

export default function Header() {
  return (
    <header className="site-header px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link
          to="/problems"
          className="font-mono text-xs font-semibold tracking-[0.14em] text-[var(--text-primary)] uppercase no-underline"
        >
          Residence Tracker °
        </Link>
      </div>
    </header>
  )
}
