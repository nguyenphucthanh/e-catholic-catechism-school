import { useTranslation } from 'react-i18next'
import type { SacramentFieldKey } from '~/lib/sacrament-schema'
import { sacramentFields } from '~/lib/sacrament-schema'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'

interface SacramentExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedFields: Set<SacramentFieldKey>
  onFieldsChange: (fields: Set<SacramentFieldKey>) => void
  onExport: (format: 'csv' | 'pdf') => void
}

export function SacramentExportDialog({
  open,
  onOpenChange,
  selectedFields,
  onFieldsChange,
  onExport,
}: SacramentExportDialogProps) {
  const { t } = useTranslation()

  const fieldOptions = sacramentFields.map((field) => ({
    key: field.key,
    label: t(field.labelKey),
  }))

  const toggleField = (fieldKey: SacramentFieldKey) => {
    const newFields = new Set(selectedFields)
    if (newFields.has(fieldKey)) {
      newFields.delete(fieldKey)
    } else {
      newFields.add(fieldKey)
    }
    onFieldsChange(newFields)
  }

  const hasAnyFieldSelected = selectedFields.size > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('common.selectFieldsToExport')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fieldOptions.map((option) => (
            <div key={option.key} className="flex items-center gap-2">
              <Checkbox
                id={option.key}
                checked={selectedFields.has(option.key)}
                onCheckedChange={() => toggleField(option.key)}
              />
              <label
                htmlFor={option.key}
                className="text-sm font-medium cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="outline"
            disabled={!hasAnyFieldSelected}
            onClick={() => onExport('csv')}
          >
            {t('common.exportCsv')}
          </Button>
          <Button
            disabled={!hasAnyFieldSelected}
            onClick={() => onExport('pdf')}
          >
            {t('common.exportPdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
