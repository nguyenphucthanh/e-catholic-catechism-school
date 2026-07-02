import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'

interface CatechistPhotoUploadProps {
  catechistId: Id<'catechists'>
  fullName: string
  onPhotoChange?: (storageId: Id<'_storage'> | null) => void
}

const MAX_FILE_SIZE = 500 * 1024

export function CatechistPhotoUpload({
  catechistId,
  fullName,
  onPhotoChange,
}: CatechistPhotoUploadProps) {
  const { t } = useTranslation()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  const photoUrl = useQuery(api.catechists.getProfilePhotoUrl, { catechistId })
  // The built-in storage module types resolve after running `npx convex dev`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateUploadUrl = useMutation((api as any).storage.generateUploadUrl)
  const updatePhoto = useMutation(api.catechists.updateProfilePhoto)
  const deletePhoto = useMutation(api.catechists.deleteProfilePhoto)

  const currentSrc = photoUrl ?? undefined

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('profile.personal.photo.error.size'))
      return
    }

    setIsUploading(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!response.ok) throw new Error('Upload failed')
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> }
      await updatePhoto({ catechistId, storageId })
      onPhotoChange?.(storageId)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    try {
      await deletePhoto({ catechistId })
      onPhotoChange?.(null)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg">
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
        {photoUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
          >
            {t('profile.personal.photo.remove')}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {t('profile.personal.photo.maxSize')}
        </p>
      </div>
    </div>
  )
}