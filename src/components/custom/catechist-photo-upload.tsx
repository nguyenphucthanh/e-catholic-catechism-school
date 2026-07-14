import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { translateConvexError } from '~/lib/convex-errors'
import { compressAndResizeImage } from '~/lib/image'

interface CatechistPhotoUploadProps {
  requesterId?: Id<'catechists'>
  catechistId?: Id<'catechists'>
  fullName: string
  onPhotoChange?: (storageId: Id<'_storage'> | null) => void
}

export function CatechistPhotoUpload({
  requesterId,
  catechistId,
  fullName,
  onPhotoChange,
}: CatechistPhotoUploadProps) {
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
    api.catechists.getProfilePhotoUrl,
    catechistId ? { catechistId } : 'skip',
  )
  // The built-in storage module types resolve after running `npx convex dev`.
  const generateUploadUrl = useMutation((api as any).storage.generateUploadUrl)
  const updatePhoto = useMutation(api.catechists.updateProfilePhoto)
  const deletePhoto = useMutation(api.catechists.deleteProfilePhoto)

  const currentSrc = (catechistId ? photoUrl : localPreviewUrl) ?? undefined
  const hasPhoto = !!(catechistId ? photoUrl : localPreviewUrl)

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
      if (catechistId && requesterId) {
        await updatePhoto({ requesterId, catechistId, storageId })
      } else {
        const previewUrl = URL.createObjectURL(processedFile)
        setLocalPreviewUrl(previewUrl)
      }
      onPhotoChange?.(storageId)
      toast.success(t('common.saved'))
    } catch (ex) {
      console.error(ex)
      toast.error(translateConvexError(ex, t))
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    try {
      if (catechistId && requesterId) {
        await deletePhoto({ requesterId, catechistId })
      } else {
        setLocalPreviewUrl(null)
      }
      onPhotoChange?.(null)
      toast.success(t('common.saved'))
    } catch (ex) {
      console.error(ex)
      toast.error(translateConvexError(ex, t))
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
