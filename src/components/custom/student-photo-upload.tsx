import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { compressAndResizeImage } from '~/lib/image'

interface StudentPhotoUploadProps {
  requesterId?: Id<'catechists'>
  studentId?: Id<'students'>
  fullName: string
  onPhotoChange?: (storageId: Id<'_storage'> | null) => void
}

export function StudentPhotoUpload({
  requesterId,
  studentId,
  fullName,
  onPhotoChange,
}: StudentPhotoUploadProps) {
  const { t } = useTranslation()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(
    null,
  )

  React.useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    }
  }, [localPreviewUrl])

  const photoUrl = useQuery(
    api.students.getProfilePhotoUrl,
    studentId ? { studentId } : 'skip',
  )
  const generateUploadUrl = useMutation((api as any).storage.generateUploadUrl)
  const updatePhoto = useMutation(api.students.updateProfilePhoto)
  const deletePhoto = useMutation(api.students.deleteProfilePhoto)

  const currentSrc = (studentId ? photoUrl : localPreviewUrl) ?? undefined
  const hasPhoto = !!(studentId ? photoUrl : localPreviewUrl)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const processedFile = await compressAndResizeImage(file)
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': processedFile.type },
        body: processedFile,
      })
      if (!response.ok) throw new Error('Upload failed')
      const { storageId } = (await response.json()) as {
        storageId: Id<'_storage'>
      }
      if (studentId && requesterId) {
        await updatePhoto({ requesterId, studentId, storageId })
      } else {
        const previewUrl = URL.createObjectURL(processedFile)
        setLocalPreviewUrl(previewUrl)
      }
      onPhotoChange?.(storageId)
      toast.success(t('common.saved'))
    } catch (ex) {
      console.error(ex)
      toast.error(t('common.error'))
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    try {
      if (studentId && requesterId) {
        await deletePhoto({ requesterId, studentId })
      } else {
        setLocalPreviewUrl(null)
      }
      onPhotoChange?.(null)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg" className={'size-32!'}>
        <AvatarImage src={currentSrc} alt={fullName} />
        <AvatarFallback>{fullName.charAt(0)}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading
            ? t('common.saving')
            : t('profile.personal.photo.upload')}
        </Button>
        {hasPhoto && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
          >
            {t('profile.personal.photo.remove')}
          </Button>
        )}
      </div>
    </div>
  )
}
