import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthState } from '../server/auth.functions'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (auth?.kind === 'member') {
      throw redirect({ to: '/problems' })
    }
    if (auth?.kind === 'no-membership') {
      throw redirect({ to: '/not-a-member' })
    }
    throw redirect({ to: '/login' })
  },
})
