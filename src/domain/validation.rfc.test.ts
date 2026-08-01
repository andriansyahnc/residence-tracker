import { describe, expect, it } from 'vitest'
import { validateComment, validateProblemInput } from './validation'

describe('validation RFC constants', () => {
  it('rejects title over 200 characters', () => {
    const result = validateProblemInput({
      title: 'a'.repeat(201),
      description: 'valid',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/200/)
  })

  it('rejects unit over 100 characters', () => {
    const result = validateProblemInput({
      title: 'Leak',
      description: 'valid',
      unit: 'x'.repeat(101),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/100/)
  })

  it('rejects comment over 2000 characters', () => {
    const result = validateComment('a'.repeat(2001))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/2000/)
  })
})
