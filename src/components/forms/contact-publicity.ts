import { Globe, Lock } from 'lucide-react'

export type ContactPublicity = 'private' | 'public'

/** Unset publicity on a stored contact means private. */
export const DEFAULT_CONTACT_PUBLICITY: ContactPublicity = 'private'

export const CONTACT_PUBLICITY_ICONS = {
  private: Lock,
  public: Globe,
} as const
