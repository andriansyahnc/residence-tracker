import { describe, expect, it } from 'vitest'
import { validateComment, validateProblemInput } from './validation'

describe('validateProblemInput', () => {
  it('requires title and description', () => {
    expect(validateProblemInput({ title: '', description: 'x' })).toEqual({
      ok: false,
      error: 'Title is required',
    })
    expect(validateProblemInput({ title: 'x', description: '   ' })).toEqual({
      ok: false,
      error: 'Description is required',
    })
  })

  it('accepts valid input with optional fields', () => {
    const result = validateProblemInput({
      title: 'Noise',
      description: 'Loud music',
      unit: '4B',
      category: 'noise',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Noise',
        description: 'Loud music',
        unit: '4B',
        category: 'noise',
      },
    })
  })

  it('rejects description over 5000 chars', () => {
    const result = validateProblemInput({
      title: 'Long',
      description: 'a'.repeat(5001),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/5000/)
    }
  })
})

describe('validateComment', () => {
  it('rejects empty comment body', () => {
    expect(validateComment('   ')).toEqual({
      ok: false,
      error: 'Comment is required',
    })
  })

  it('accepts non-empty comment', () => {
    expect(validateComment('Thanks')).toEqual({ ok: true, value: 'Thanks' })
  })
})
