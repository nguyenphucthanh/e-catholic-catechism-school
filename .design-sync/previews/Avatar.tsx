import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from '~/components/ui/avatar'

export function ImageAndFallback() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar size="sm">
        <AvatarImage src="https://i.pravatar.cc/150?img=12" alt="Catechist" />
        <AvatarFallback>CT</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/150?img=32" alt="Student" />
        <AvatarFallback>NA</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>TB</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarImage src="https://i.pravatar.cc/150?img=45" alt="Principal" />
        <AvatarFallback>PR</AvatarFallback>
        <AvatarBadge>
          <span className="size-1 rounded-full bg-primary-foreground" />
        </AvatarBadge>
      </Avatar>
    </div>
  )
}

export function Group() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/150?img=5" alt="Student" />
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/150?img=9" alt="Student" />
        <AvatarFallback>BI</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>CU</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+5</AvatarGroupCount>
    </AvatarGroup>
  )
}
