import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { api } from '../../../convex/_generated/api'
import type { ComponentProps, FC } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'

export type ProfileAvatarProps = {
  userType: 'catechist' | 'student'
  userId: string
  fullName: string
} & ComponentProps<typeof Avatar>

export const ProfileAvatar: FC<ProfileAvatarProps> = ({
  userType,
  userId,
  fullName,
  ...props
}) => {
  const appConfig = useQuery(api.appConfig.get)
  const nameFormat = appConfig?.nameFormat
  const fallbackName = useMemo(() => {
    if (nameFormat === 'lastName_firstName') {
      return fullName[0] || '-'
    }
    return fullName.split(' ').pop()?.[0] ?? '-'
  }, [nameFormat, fullName])

  const catechistPhotoUrl = useQuery(
    api.catechists.getProfilePhotoUrl,
    userType === 'catechist' && userId
      ? { catechistId: userId as unknown as Id<'catechists'> }
      : 'skip',
  )

  const studentPhotoUrl = useQuery(
    api.students.getProfilePhotoUrl,
    userType === 'student' && userId
      ? { studentId: userId as unknown as Id<'students'> }
      : 'skip',
  )

  const src = userType === 'catechist' ? catechistPhotoUrl : studentPhotoUrl

  return (
    <Avatar {...props}>
      <AvatarImage src={src ?? undefined} alt={fullName} />
      <AvatarFallback>{fallbackName}</AvatarFallback>
    </Avatar>
  )
}
