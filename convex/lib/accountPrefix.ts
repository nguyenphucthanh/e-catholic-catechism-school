export function getCatechistAccountPrefix(): string {
  return process.env.CATECHIST_ACCOUNT_PREFIX || 'CAT'
}

export function getStudentAccountPrefix(): string {
  return process.env.STUDENT_ACCOUNT_PREFIX || 'STD'
}

export function getCatechistLoginId(memberId: string): string {
  return `${getCatechistAccountPrefix()}-${memberId}`
}

export function getStudentLoginId(studentCode: string): string {
  return `${getStudentAccountPrefix()}-${studentCode}`
}
