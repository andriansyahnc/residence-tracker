import { Link } from '@tanstack/react-router'
import { canIplStaff } from '../domain/permissions'
import type { SessionUser } from '../domain/types'

export function IplNavTabs({
  user,
  active,
}: {
  user: SessionUser
  active: 'masalah' | 'ipl' | 'laporan' | 'verifikasi' | 'pengeluaran'
}) {
  const staff = canIplStaff({
    userId: user.userId,
    residenceId: user.residenceId,
    role: user.role,
  })

  const tabs = staff
    ? ([
        { id: 'verifikasi', to: '/ipl/verifikasi', label: 'Verifikasi' },
        { id: 'pengeluaran', to: '/ipl/pengeluaran', label: 'Pengeluaran' },
        { id: 'laporan', to: '/ipl/laporan', label: 'Laporan' },
        { id: 'masalah', to: '/problems', label: 'Masalah' },
      ] as const)
    : ([
        { id: 'masalah', to: '/problems', label: 'Masalah' },
        { id: 'ipl', to: '/ipl', label: 'IPL' },
        { id: 'laporan', to: '/ipl/laporan', label: 'Laporan' },
      ] as const)

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          className={`auralis-filter ${active === tab.id ? 'auralis-filter-active' : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
