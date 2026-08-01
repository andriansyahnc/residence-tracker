import { describe, expect, it } from 'vitest'
import { getAllowedTransitions } from './status'

describe('status lifecycle RFC', () => {
  it('allows manager to skip ack and move submitted to in_progress', () => {
    expect(getAllowedTransitions('submitted', 'manager')).toContain('in_progress')
  })

  it('forbids reopen from rejected', () => {
    expect(getAllowedTransitions('rejected', 'manager')).toEqual([])
  })
})
