import { useTranslation } from 'react-i18next'
import type { ScanFeedback } from '~/components/custom/use-scan-feedback'
import { QRScanner } from '~/components/custom/qr-scanner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

const FEEDBACK_CLASS: Record<ScanFeedback['status'], string> = {
  success: 'bg-emerald-600',
  duplicate: 'bg-amber-500',
  unknown: 'bg-red-600',
}

interface ScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Camera runs only while true (e.g. no confirm dialog is on top). */
  active: boolean
  onScan: (code: string) => void
  feedback: ScanFeedback | null
  /** i18n key shown for an unrecognised code. */
  unknownLabelKey: string
}

export function ScanDialog({
  open,
  onOpenChange,
  active,
  onScan,
  feedback,
  unknownLabelKey,
}: ScanDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('attendance.createSession.scanStart')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('attendance.createSession.scanStart')}
          </DialogDescription>
        </DialogHeader>
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl border">
          <QRScanner active={active} onScan={onScan} />
          {feedback && (
            <div
              role="status"
              className={`absolute inset-x-4 top-4 rounded-full px-4 py-2 text-center text-sm font-semibold text-white shadow-md ${FEEDBACK_CLASS[feedback.status]}`}
            >
              {feedback.status === 'unknown'
                ? t(unknownLabelKey)
                : `${feedback.name} — ${t(
                    feedback.status === 'success'
                      ? 'attendance.scanning.overlay.success'
                      : 'attendance.scanning.overlay.duplicate',
                  )}`}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
