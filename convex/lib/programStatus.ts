export type ProgramStatus = 'upcoming' | 'active' | 'past'

// Single source of truth for the extracurricular program date-boundary rule —
// shared by extracurricularPrograms.ts (server filter) and the catechist/
// student program detail routes (status badge).
export function getProgramStatus(
  dateStart: string,
  dateEnd: string,
  today: string,
): ProgramStatus {
  if (dateStart > today) return 'upcoming'
  if (dateEnd < today) return 'past'
  return 'active'
}
