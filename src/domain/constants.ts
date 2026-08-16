/** The sandbox residence the committee can play with. See src/db/demo-seed.ts. */
export const DEMO_RESIDENCE_ID = 'res-demo'

export const LIMITS = {
  titleMax: 200,
  descriptionMax: 5000,
  unitMax: 100,
  commentMax: 2000,
  createsPerHour: 10,
  commentsPerHour: 60,
} as const
