// Re-export all mutations and queries from the split modules
// This preserves the API surface for existing code
export {
  listPrograms,
  getProgramDetail,
  createProgram,
  updateProgram,
  deleteProgram,
} from './programs/admin'
export {
  listEligiblePrograms,
  getEnrollments,
  enrollProgram,
  unenrollProgram,
  updateEnrollmentPaymentStatus,
} from './programs/enrollment'
