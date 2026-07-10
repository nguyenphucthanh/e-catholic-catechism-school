import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { ValidatedRow } from './useImportParser'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'

interface ImportStep5ConfirmProps {
  validatedRows: Array<ValidatedRow>
  target: 'students' | 'catechists'
  onBack: () => void
  onStartImport: () => void
}

export function ImportStep5Confirm({
  validatedRows,
  target,
  onBack,
  onStartImport,
}: ImportStep5ConfirmProps) {
  const { t } = useTranslation()
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [duplicatesOpen, setDuplicatesOpen] = React.useState(false)

  const importableCount = React.useMemo(
    () =>
      validatedRows.filter(
        (r) =>
          (r.status === 'ok' || r.status === 'partial') && r.selected !== false,
      ).length,
    [validatedRows],
  )

  const skippedCount = React.useMemo(
    () =>
      validatedRows.filter((r) => r.status === 'error' && r.selected !== false)
        .length,
    [validatedRows],
  )

  const duplicateRows = React.useMemo(
    () =>
      validatedRows.filter((r) => !!r.duplicateWarning && r.selected !== false),
    [validatedRows],
  )

  const targetLabel =
    target === 'students'
      ? t('csvImport.config.targetStudents', 'Students (Học Sinh)')
      : t('csvImport.config.targetCatechists', 'Catechists (Giáo Lý Viên)')

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {t('csvImport.confirm.title', 'Ready to import?')}
          </CardTitle>
          <CardDescription>
            {t(
              'csvImport.confirm.summary',
              '{{count}} records will be saved to {{target}}.',
              { count: importableCount, target: targetLabel },
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-2xl font-semibold">{importableCount}</div>
              <div className="text-muted-foreground">
                {t('csvImport.confirm.toImport', 'To import')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{skippedCount}</div>
              <div className="text-muted-foreground">
                {t('csvImport.confirm.skipped', 'Skipped (errors)')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold">
                {duplicateRows.length}
              </div>
              <div className="text-muted-foreground">
                {t('csvImport.confirm.duplicates', 'Possible duplicates')}
              </div>
            </div>
          </div>

          {duplicateRows.length > 0 && (
            <Collapsible open={duplicatesOpen} onOpenChange={setDuplicatesOpen}>
              <CollapsibleTrigger
                render={
                  <Button type="button" variant="link" className="px-0 w-fit">
                    {duplicatesOpen
                      ? t(
                          'csvImport.confirm.hideDuplicates',
                          'Hide duplicate names',
                        )
                      : t(
                          'csvImport.confirm.showDuplicates',
                          'Show duplicate names',
                        )}
                  </Button>
                }
              />
              <CollapsibleContent>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {duplicateRows.map((row) => (
                    <li key={row.rowIndex}>{row.duplicateWarning}</li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}

          {duplicateRows.length > 0 && (
            <p className="text-sm text-amber-600">
              {t(
                'csvImport.confirm.duplicatesAlert',
                '{{count}} rows match existing records by name. Duplicates will still be created.',
                { count: duplicateRows.length },
              )}
            </p>
          )}

          <label className="flex items-center gap-2 pt-2">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(value) => setAcknowledged(!!value)}
            />
            <span className="text-sm">
              {t(
                'csvImport.confirm.acknowledge',
                'I understand that duplicate records may be created. Proceed anyway.',
              )}
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('common.back', 'Back')}
        </Button>
        <Button
          type="button"
          disabled={!acknowledged || importableCount === 0}
          onClick={onStartImport}
        >
          {t('csvImport.confirm.startImport', 'Start Import')}
        </Button>
      </div>
    </div>
  )
}
