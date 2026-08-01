import type { ProblemCategory, ValidationResult } from './types'

const CATEGORIES: ProblemCategory[] = [
  'maintenance',
  'facilities',
  'safety',
  'noise',
  'other',
]

const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 5000
const MAX_UNIT_LENGTH = 100
const MAX_COMMENT_LENGTH = 2000

export type ProblemInput = {
  title: string
  description: string
  unit?: string
  category?: ProblemCategory
}

export function validateProblemInput(input: ProblemInput): ValidationResult<{
  title: string
  description: string
  unit?: string
  category?: ProblemCategory
}> {
  const title = input.title.trim()
  const description = input.description.trim()

  if (!title) {
    return { ok: false, error: 'Title is required' }
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Title must be ${MAX_TITLE_LENGTH} characters or less`,
    }
  }
  if (!description) {
    return { ok: false, error: 'Description is required' }
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
    }
  }

  const unit = input.unit?.trim()
  const category = input.category

  if (unit && unit.length > MAX_UNIT_LENGTH) {
    return {
      ok: false,
      error: `Unit must be ${MAX_UNIT_LENGTH} characters or less`,
    }
  }

  if (category && !CATEGORIES.includes(category)) {
    return { ok: false, error: 'Invalid category' }
  }

  return {
    ok: true,
    value: {
      title,
      description,
      ...(unit ? { unit } : {}),
      ...(category ? { category } : {}),
    },
  }
}

export function validateComment(body: string): ValidationResult<string> {
  const trimmed = body.trim()
  if (!trimmed) {
    return { ok: false, error: 'Comment is required' }
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Comment must be ${MAX_COMMENT_LENGTH} characters or less`,
    }
  }
  return { ok: true, value: trimmed }
}
