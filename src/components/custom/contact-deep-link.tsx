import type { FC } from 'react'

export type ContactDeepLinkProps = {
  value: string
  type: 'phone' | 'email' | 'zalo' | 'other'
}

export const ContactDeepLink: FC<ContactDeepLinkProps> = ({ value, type }) => {
  if (type === 'phone') {
    return (
      <a className="text-primary" target="_blank" href={`tel:${value}`}>
        {value}
      </a>
    )
  }

  if (type === 'email') {
    return (
      <a className="text-primary" target="_blank" href={`mailto:${value}`}>
        {value}
      </a>
    )
  }

  if (type === 'zalo') {
    return (
      <a
        className="text-primary"
        target="_blank"
        href={`https://zalo.me/${value}`}
      >
        {value}
      </a>
    )
  }

  return <>{value}</>
}
