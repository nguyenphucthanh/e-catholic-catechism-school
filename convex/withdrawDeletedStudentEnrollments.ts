import { internalMutation } from './_generated/server'
import { isActiveEnrollment } from './lib/enrollment'

// One-off cleanup. students.softDelete used to allow deleting a student whose
// enrollment was on_leave, leaving that enrollment on the class roster. Class
// headcounts now count enrollments without re-reading students, so withdraw
// any non-withdrawn enrollment that still points at a deleted student.
//
// Run once per deployment:
//   npx convex run withdrawDeletedStudentEnrollments:withdrawDeletedStudentEnrollments
export const withdrawDeletedStudentEnrollments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10)

    const deletedStudents = await ctx.db
      .query('students')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', true))
      .collect()

    let withdrawnCount = 0
    for (const student of deletedStudents) {
      const enrollments = await ctx.db
        .query('studentClasses')
        .withIndex('by_student_id', (q) => q.eq('studentId', student._id))
        .collect()

      for (const enrollment of enrollments.filter(isActiveEnrollment)) {
        await ctx.db.patch('studentClasses', enrollment._id, {
          status: 'withdrawn',
          statusChangedDate: today,
          leftDate: today,
        })
        withdrawnCount++
      }
    }

    return {
      deletedStudentCount: deletedStudents.length,
      withdrawnCount,
    }
  },
})
