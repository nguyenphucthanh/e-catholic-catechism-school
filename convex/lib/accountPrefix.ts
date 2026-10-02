import { env } from '../_generated/server'

export function getCatechistAccountPrefix(): string {
  return env.CATECHIST_ACCOUNT_PREFIX || 'CAT'
}

export function getStudentAccountPrefix(): string {
  return env.STUDENT_ACCOUNT_PREFIX || 'STD'
}

export function getCatechistLoginId(memberId: string): string {
  return `${getCatechistAccountPrefix()}-${memberId}`
}

export function getStudentLoginId(studentCode: string): string {
  return `${getStudentAccountPrefix()}-${studentCode}`
}
