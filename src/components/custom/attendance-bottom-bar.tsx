import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group'

interface AttendanceBottomBarProps {
  searchPlaceholder: string
  search: string
  onSearchChange: (value: string) => void
  onCancel: () => void
  saveLabel: string
  saveDisabled?: boolean
  isSubmitting: boolean
  /** Submit the <form id="..."> with this id (real submit button). */
  form?: string
  /** Used instead when saving is not a plain form submit. */
  onSave?: () => void
}

export function AttendanceBottomBar({
  searchPlaceholder,
  search,
  onSearchChange,
  onCancel,
  saveLabel,
  saveDisabled,
  isSubmitting,
  form,
  onSave,
}: AttendanceBottomBarProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:left-[var(--sidebar-width)] z-50 p-4 border-t bg-background/80 backdrop-blur-md shadow-lg flex items-center gap-4 transition-[left] ease-linear duration-200">
      <InputGroup className="flex-1">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </InputGroup>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type={form ? 'submit' : 'button'}
          form={form}
          onClick={onSave}
          disabled={isSubmitting || saveDisabled}
        >
          {isSubmitting ? t('common.saving') : saveLabel}
        </Button>
      </div>
    </div>
  )
}
