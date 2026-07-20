import * as React from 'react'
import {
  Link,
  Navigate,
  createFileRoute,
  useParams,
} from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Camera, RotateCcw, SkipForward, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { PhotoboothStudent } from '~/hooks/use-photobooth-queue'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'
import { useAuth } from '~/lib/auth'
import { isCatechist } from '~/lib/permissions'
import { formatPersonName } from '~/lib/name'
import { compressAndResizeImage } from '~/lib/image'
import { translateConvexError } from '~/lib/convex-errors'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { ProfileAvatar } from '~/components/custom/profile-avatar'
import { usePhotoboothQueue } from '~/hooks/use-photobooth-queue'

export const Route = createFileRoute('/classes/$id/photobooth')({
  component: PhotoboothPage,
})

function PhotoboothPage() {
  const { id } = useParams({ strict: false })
  const classId = id as Id<'classes'>
  const { t } = useTranslation()
  const { user, isHydrated } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const { isInactive } = useInactiveYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const classDetails = useQuery(
    api.classes.getClassDetails,
    requesterId && selectedYearId && classId
      ? { requesterId, classId, academicYearId: selectedYearId }
      : 'skip',
  )

  if (isHydrated === false) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (!isCatechist(user)) {
    return <Navigate to="/dashboard" />
  }

  if (classDetails === undefined) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-64 rounded-full" />
      </div>
    )
  }

  const canEnter =
    classDetails !== null && classDetails.canManageEnrollments && !isInactive

  if (!canEnter) {
    return <Navigate to="/classes/$id" params={{ id: classId }} />
  }

  const students: Array<PhotoboothStudent> = classDetails.students
    .filter((s) => s.enrollment.status === 'active')
    .map((s) => ({
      studentId: s.student._id,
      fullName: s.student.fullName,
      saintName: s.student.saintName,
      hasPhoto: !!s.student.profilePhotoStorageId,
    }))

  return (
    <PhotoboothSession
      classId={classId}
      requesterId={requesterId as Id<'catechists'>}
      className={classDetails.class.name}
      students={students}
      t={t}
    />
  )
}

function PhotoboothSession({
  classId,
  requesterId,
  className,
  students,
  t,
}: {
  classId: Id<'classes'>
  requesterId: Id<'catechists'>
  className: string
  students: Array<PhotoboothStudent>
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [previewFile, setPreviewFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  const generateUploadUrl = useMutation((api as any).storage.generateUploadUrl)
  const updatePhoto = useMutation(api.students.updateProfilePhoto)

  const queue = usePhotoboothQueue(students)
  const { current } = queue

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewFile(null)
    setPreviewUrl(null)
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressAndResizeImage(file)
    setPreviewFile(compressed)
    setPreviewUrl(URL.createObjectURL(compressed))
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRetake = () => {
    clearPreview()
    inputRef.current?.click()
  }

  const handleSkip = () => {
    clearPreview()
    queue.skip()
  }

  const handleUsePhoto = async () => {
    if (!previewFile || !current) return
    setIsUploading(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': previewFile.type },
        body: previewFile,
      })
      if (!response.ok) throw new Error('Upload failed')
      const { storageId } = (await response.json()) as {
        storageId: Id<'_storage'>
      }
      await updatePhoto({
        requesterId,
        studentId: current.studentId as Id<'students'>,
        storageId,
      })
      toast.success(t('common.saved'))
      clearPreview()
      queue.confirm()
    } catch (ex) {
      toast.error(translateConvexError(ex, t))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b p-4">
        <Link
          to="/classes/$id"
          params={{ id: classId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
          {t('photobooth.exit')}
        </Link>
        <span className="text-sm font-medium text-muted-foreground">
          {className}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {queue.isDone || !current ? (
          <PhotoboothSummary
            classId={classId}
            confirmedCount={queue.confirmedCount}
            total={queue.total}
            missingStudents={queue.missingStudents}
            t={t}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t('photobooth.progress', {
                current: queue.confirmedCount + 1,
                total: queue.total,
              })}
            </p>
            <h1 className="text-center text-3xl font-bold">
              {formatPersonName(current.saintName, current.fullName)}
            </h1>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />

            {previewUrl ? (
              <div className="flex w-full max-w-sm flex-col items-center gap-4">
                <img
                  src={previewUrl}
                  alt={current.fullName}
                  className="aspect-square w-64 rounded-lg object-cover"
                />
                <div className="flex w-full gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isUploading}
                    onClick={handleRetake}
                  >
                    <RotateCcw className="size-4" />
                    {t('photobooth.retake')}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={isUploading}
                    onClick={handleUsePhoto}
                  >
                    {isUploading
                      ? t('common.saving')
                      : t('photobooth.usePhoto')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex w-full max-w-sm flex-col items-center gap-4">
                <ProfileAvatar
                  className="size-40!"
                  userType="student"
                  userId={current.studentId}
                  fullName={current.fullName}
                />
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => inputRef.current?.click()}
                >
                  <Camera className="size-4" />
                  {t('photobooth.capture')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleSkip}
                >
                  <SkipForward className="size-4" />
                  {t('photobooth.skip')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PhotoboothSummary({
  classId,
  confirmedCount,
  total,
  missingStudents,
  t,
}: {
  classId: Id<'classes'>
  confirmedCount: number
  total: number
  missingStudents: Array<PhotoboothStudent>
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-bold">{t('photobooth.summary.title')}</h1>
      <p className="text-lg">
        {t('photobooth.summary.captured', { count: confirmedCount, total })}
      </p>

      {missingStudents.length > 0 && (
        <div className="w-full text-left">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {t('photobooth.summary.stillMissing')}
          </p>
          <ul className="max-h-48 w-full overflow-y-auto rounded-lg border divide-y">
            {missingStudents.map((s) => (
              <li key={s.studentId} className="px-3 py-2 text-sm">
                {formatPersonName(s.saintName, s.fullName)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link to="/classes/$id" params={{ id: classId }} className="w-full">
        <Button type="button" className="w-full">
          {t('photobooth.summary.done')}
        </Button>
      </Link>
    </div>
  )
}
