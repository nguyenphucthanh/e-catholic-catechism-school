import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as React from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { translateConvexError } from '~/lib/convex-errors'

export function useEnrollProgram(params: {
  programId: Id<'extracurricularPrograms'>
  requesterId?: Id<'catechists'>
  studentRequesterId?: Id<'students'>
  onEnrolled?: () => void
}) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const enrollProgram = useMutation(api.extracurricularPrograms.enrollProgram)
  const unenrollProgram = useMutation(
    api.extracurricularPrograms.unenrollProgram,
  )

  const handleEnroll = async () => {
    if (!params.requesterId && !params.studentRequesterId) return
    setIsSubmitting(true)
    try {
      await enrollProgram({
        programId: params.programId,
        requesterId: params.requesterId,
        studentRequesterId: params.studentRequesterId,
      })
      toast.success(t('extracurricular.enrolledSuccess'))
      params.onEnrolled?.()
    } catch (error) {
      toast.error(translateConvexError(error, t))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnenroll = async () => {
    if (!params.requesterId && !params.studentRequesterId) return
    setIsSubmitting(true)
    try {
      await unenrollProgram({
        programId: params.programId,
        requesterId: params.requesterId,
        studentRequesterId: params.studentRequesterId,
      })
      toast.success(t('extracurricular.unenrolledSuccess'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
    } finally {
      setIsSubmitting(false)
    }
  }

  return { handleEnroll, handleUnenroll, isSubmitting }
}
