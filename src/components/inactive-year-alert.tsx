import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { useInactiveYear } from '~/lib/academic-year'

export function InactiveYearAlert() {
  const { t } = useTranslation()
  const { isInactive, yearName } = useInactiveYear()

  if (!isInactive) return null

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{t('inactiveYear.title')}</AlertTitle>
      <AlertDescription>
        {t(
          'inactiveYear.description',
          'The academic year is inactive and locked for editing. All data is read-only.',
          { yearName: yearName ?? '' },
        )}
      </AlertDescription>
    </Alert>
  )
}
