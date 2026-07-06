import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Upload as UploadIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

const MAX_ROWS = 500

interface ImportStep1UploadProps {
  file: File | null
  rawText: string
  onFileAccepted: (file: File, rawText: string) => void
  onNext: () => void
}

export function ImportStep1Upload({
  file,
  rawText,
  onFileAccepted,
  onNext,
}: ImportStep1UploadProps) {
  const { t } = useTranslation()
  const [error, setError] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const rowCount = React.useMemo(() => {
    if (!rawText) return 0
    const lines = rawText.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '')
    return Math.max(lines.length - 1, 0)
  }, [rawText])

  const processFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError(t('csvImport.upload.invalidType', 'Please select a CSV file.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '')
      const count = Math.max(lines.length - 1, 0)
      if (count > MAX_ROWS) {
        setError(
          t(
            'csvImport.upload.rowLimitError',
            'File contains more than 500 rows. Please split into smaller files.',
          ),
        )
        return
      }
      setError(null)
      onFileAccepted(f, text)
    }
    reader.onerror = () => {
      setError(t('csvImport.upload.readError', 'Failed to read file.'))
    }
    reader.readAsText(f, 'utf-8')
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!f) return
    processFile(f)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ''
  }

  const canProceed = !!file && !error && rowCount > 0 && rowCount <= MAX_ROWS

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>
          {t('csvImport.upload.warningTitle', 'UTF-8 Encoding Required')}
        </AlertTitle>
        <AlertDescription>
          {t(
            'csvImport.upload.warning',
            'Please prepare a UTF-8 encoded CSV file to avoid garbled Vietnamese characters.',
          )}
        </AlertDescription>
      </Alert>

      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-input hover:border-primary/50',
        )}
      >
        <UploadIcon className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t(
            'csvImport.upload.dragDrop',
            'Drag & drop a CSV file here, or click to browse',
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {file && !error && (
        <Alert>
          <FileText className="size-4" />
          <AlertDescription>
            {t(
              'csvImport.upload.selected',
              'Selected: {{name}} ({{rows}} rows)',
              { name: file.name, rows: rowCount },
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="button" disabled={!canProceed} onClick={onNext}>
          {t('common.next', 'Next')}
        </Button>
      </div>
    </div>
  )
}
