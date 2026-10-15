import * as React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type AttendanceStatus =
  'present' | 'late' | 'unexcused_absence' | 'excused_absence'

/** Tile-only extra state: no saved record yet (opt-in via `allowUnset`). */
export type TileStatus = AttendanceStatus | 'unset'

export const STATUS_CONFIG = {
  present: {
    bg: 'bg-[#bbf7d0]',
    textColor: 'text-green-800',
    iconColor: 'text-neutral-900',
    Icon: CheckCircle2,
    labelKey: 'attendance.status.present.short',
  },
  late: {
    bg: 'bg-[#fef08a]',
    textColor: 'text-yellow-800',
    iconColor: 'text-neutral-900',
    Icon: Clock,
    labelKey: 'attendance.status.late.short',
  },
  unexcused_absence: {
    bg: 'bg-[#fca5a5]',
    textColor: 'text-red-800',
    iconColor: 'text-neutral-900',
    Icon: AlertCircle,
    labelKey: 'attendance.status.unexcused_absence.short',
  },
  excused_absence: {
    bg: 'bg-[#e9d5ff]',
    textColor: 'text-purple-800',
    iconColor: 'text-neutral-900',
    Icon: AlertTriangle,
    labelKey: 'attendance.status.excused_absence.short',
  },
}

const UNSET_CONFIG = {
  bg: 'bg-[#e5e7eb]',
  Icon: Circle,
  labelKey: 'attendance.status.unset.short',
}

export function AttendanceTile<TUnset extends boolean = false>({
  id,
  saintName,
  fullName,
  subtitle,
  status,
  expanded,
  onExpand,
  onCollapse,
  onSelect,
  allowUnset,
}: {
  id: string
  saintName?: string | null
  fullName: string
  subtitle: React.ReactNode
  status: TUnset extends true ? TileStatus : AttendanceStatus
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onSelect: (
    status: TUnset extends true ? TileStatus : AttendanceStatus,
  ) => void
  /** Adds a fifth 'unset' option to the picker. */
  allowUnset?: TUnset
}) {
  const { t } = useTranslation()
  const current: TileStatus = status
  const select = onSelect as (status: TileStatus) => void
  const config = current === 'unset' ? UNSET_CONFIG : STATUS_CONFIG[current]
  const Icon = config.Icon

  return (
    <div
      id={id}
      className="relative border rounded-xl overflow-hidden bg-card flex justify-between items-center h-20 shadow-sm transition-all duration-300"
    >
      {/* Collapsed view left part (Always visible unless expanded covering it) */}
      <div className="pl-4 flex flex-col justify-center flex-1 pr-2 overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          {saintName && (
            <span className="italic text-xs text-muted-foreground truncate max-w-[100px]">
              {saintName}
            </span>
          )}
          <span className="font-semibold text-sm text-foreground truncate min-w-0">
            {fullName}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {subtitle}
        </span>
      </div>

      {/* Collapsed state status button */}
      <button
        type="button"
        onClick={onExpand}
        className={`h-full w-16 flex flex-col items-center justify-center cursor-pointer border-l ${config.bg} transition-colors duration-200 hover:brightness-95`}
      >
        <Icon className="h-6 w-6 text-neutral-900" />
      </button>

      {/* Expanded state slide-out panel */}
      {expanded && (
        <div className="absolute inset-0 bg-background flex items-center justify-end z-10 animate-in slide-in-from-right duration-200">
          <div
            className="flex-1 pl-4 pr-2 text-xs font-semibold text-muted-foreground truncate h-full flex items-center cursor-pointer"
            onClick={onCollapse}
            title={fullName}
          >
            {fullName}
          </div>
          <div className="flex h-full border-l shrink-0">
            {(
              [
                ...(Object.keys(STATUS_CONFIG) as Array<AttendanceStatus>),
                ...(allowUnset ? (['unset'] as const) : []),
              ] as Array<TileStatus>
            ).map((st) => {
              const opt = st === 'unset' ? UNSET_CONFIG : STATUS_CONFIG[st]
              const OptIcon = opt.Icon
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => select(st)}
                  className={`h-full px-3 flex flex-col items-center justify-center gap-0.5 border-r last:border-r-0 cursor-pointer ${opt.bg} transition-colors duration-200 hover:brightness-95`}
                  style={{ minWidth: '64px' }}
                >
                  <OptIcon className="h-4.5 w-4.5 text-neutral-900" />
                  <span className="text-[8px] font-extrabold text-neutral-900 uppercase tracking-tight text-center leading-none">
                    {t(opt.labelKey)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
