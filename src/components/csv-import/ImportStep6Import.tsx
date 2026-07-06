import * as React from 'react'
import { useAction } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { ImportRowResult } from '~/routes/_authenticated/_catechist/_admin/import'
import type { ValidatedRow } from './useImportParser'
import { Button } from '~/components/ui/button'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '~/components/ui/progress'

const CHUNK_SIZE = 50

interface ImportStep6ImportProps {
  validatedRows: Array<ValidatedRow>
  target: 'students' | 'catechists'
  requesterId: Id<'catechists'>
  onComplete: (results: Array<ImportRowResult>) => void
}

type StudentRecord = {
  fullName: string
  saintName?: string
  dateOfBirth?: string
  gender?: 'male' | 'female'
  previousParish?: string
  previousDiocese?: string
  isActive?: boolean
  guardian?: {
    fullName: string
    saintName?: string
    relationship: string
    phone?: string
    email?: string
  }
}

type CatechistRecord = {
  fullName: string
  saintName?: string
  dateOfBirth?: string
  gender?: 'male' | 'female'
  joinedDate?: string
  title?: string
  community?: string
  level?: string
  notes?: string
  phone?: string
  email?: string
}

function buildStudentRecord(
  coerced: Record<string, string | null>,
): StudentRecord {
  const record: StudentRecord = {
    fullName: coerced.fullName ?? '',
  }
  if (coerced.saintName) record.saintName = coerced.saintName
  if (coerced.dateOfBirth) record.dateOfBirth = coerced.dateOfBirth
  if (coerced.gender === 'male' || coerced.gender === 'female') {
    record.gender = coerced.gender
  }
  if (coerced.previousParish) record.previousParish = coerced.previousParish
  if (coerced.previousDiocese) record.previousDiocese = coerced.previousDiocese
  if (coerced.isActive) record.isActive = coerced.isActive === 'true'

  if (coerced.guardian_name) {
    record.guardian = {
      fullName: coerced.guardian_name,
      relationship: coerced.guardian_relationship ?? '',
    }
    if (coerced.guardian_saint_name) {
      record.guardian.saintName = coerced.guardian_saint_name
    }
    if (coerced.guardian_phone) record.guardian.phone = coerced.guardian_phone
    if (coerced.guardian_email) record.guardian.email = coerced.guardian_email
  }

  return record
}

function buildCatechistRecord(
  coerced: Record<string, string | null>,
): CatechistRecord {
  const record: CatechistRecord = {
    fullName: coerced.fullName ?? '',
  }
  if (coerced.saintName) record.saintName = coerced.saintName
  if (coerced.dateOfBirth) record.dateOfBirth = coerced.dateOfBirth
  if (coerced.gender === 'male' || coerced.gender === 'female') {
    record.gender = coerced.gender
  }
  if (coerced.joinedDate) record.joinedDate = coerced.joinedDate
  if (coerced.title) record.title = coerced.title
  if (coerced.community) record.community = coerced.community
  if (coerced.level) record.level = coerced.level
  if (coerced.notes) record.notes = coerced.notes
  if (coerced.phone) record.phone = coerced.phone
  if (coerced.email) record.email = coerced.email
  return record
}

function chunk<T>(items: Array<T>, size: number): Array<Array<T>> {
  const chunks: Array<Array<T>> = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export function ImportStep6Import({
  validatedRows,
  target,
  requesterId,
  onComplete,
}: ImportStep6ImportProps) {
  const { t } = useTranslation()
  const bulkImportStudents = useAction(api.csvImport.bulkImportStudents)
  const bulkImportCatechists = useAction(api.csvImport.bulkImportCatechists)

  const [processed, setProcessed] = React.useState(0)
  const [currentBatch, setCurrentBatch] = React.useState(0)
  const [importing, setImporting] = React.useState(true)
  const hasStartedRef = React.useRef(false)

  const importableRows = React.useMemo(
    () => validatedRows.filter((r) => r.status !== 'error'),
    [validatedRows],
  )
  const skippedCount = validatedRows.length - importableRows.length
  const total = importableRows.length
  const batches = React.useMemo(
    () => chunk(importableRows, CHUNK_SIZE),
    [importableRows],
  )

  React.useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    async function run() {
      const results: Array<ImportRowResult> = []
      let processedCount = 0

      // Errored rows are skipped entirely — surface as skipped errors in the
      // final result set so the summary accounts for every original row.
      for (const row of validatedRows) {
        if (row.status === 'error') {
          results.push({
            index: row.rowIndex,
            status: 'error',
            error: t(
              'csvImport.importing.rowSkipped',
              'Skipped due to validation errors',
            ),
          })
        }
      }

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b]
        setCurrentBatch(b + 1)

        const records = batch.map((row) =>
          target === 'students'
            ? buildStudentRecord(row.coerced)
            : buildCatechistRecord(row.coerced),
        )

        try {
          const batchResults =
            target === 'students'
              ? await bulkImportStudents({
                  requesterId,
                  records: records,
                })
              : await bulkImportCatechists({
                  requesterId,
                  records: records,
                })

          batchResults.forEach((res, localIndex) => {
            const originalRow = batch[localIndex]
            if (res.status === 'ok') {
              results.push({
                index: originalRow.rowIndex,
                status: 'ok',
                id: res.id,
              })
            } else {
              results.push({
                index: originalRow.rowIndex,
                status: 'error',
                error: res.error,
              })
            }
          })
        } catch (e) {
          batch.forEach((row) => {
            results.push({
              index: row.rowIndex,
              status: 'error',
              error: String(e),
            })
          })
        }

        processedCount += batch.length
        setProcessed(processedCount)
      }

      setImporting(false)
      toast.success(
        t('csvImport.importing.success', 'Imported {{count}} records', {
          count: results.filter((r) => r.status === 'ok').length,
        }),
      )
      onComplete(results)
    }

    void run()
  }, [])

  const progressValue =
    total === 0 ? 100 : Math.round((processed / total) * 100)

  return (
    <div className="flex flex-col gap-6 items-center py-8">
      <p className="text-sm text-muted-foreground">
        {importing
          ? t('csvImport.importing.inProgress', 'Importing records…')
          : t('csvImport.importing.done', 'Import complete')}
      </p>

      <div className="w-full max-w-md flex flex-col gap-2">
        <Progress value={progressValue}>
          <ProgressLabel>
            {t('csvImport.importing.batch', 'Batch {{current}} / {{total}}', {
              current: currentBatch,
              total: batches.length,
            })}
          </ProgressLabel>
          <ProgressValue />
        </Progress>
        <p className="text-sm text-center text-muted-foreground">
          {t(
            'csvImport.importing.progress',
            '{{processed}} / {{total}} records',
            {
              processed,
              total,
            },
          )}
        </p>
        {skippedCount > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            {t(
              'csvImport.importing.skippedNote',
              '{{count}} rows skipped due to validation errors',
              { count: skippedCount },
            )}
          </p>
        )}
      </div>

      <div className="w-full flex justify-start pt-4 border-t">
        <Button type="button" variant="outline" disabled>
          {t('common.back', 'Back')}
        </Button>
      </div>
    </div>
  )
}
