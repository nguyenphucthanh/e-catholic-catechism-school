import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Kanban, PlusIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { api } from '../../../../../convex/_generated/api'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Alert, AlertDescription } from '~/components/ui/alert'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/students_/relocate',
)({
  component: RelocateStudentsPage,
  staticData: {
    crumbs: [{ label: 'nav.admin' }, { label: 'students.relocate.title' }],
  },
})

type RosterStudent = {
  studentId: Id<'students'>
  studentCode: string
  fullName: string
  saintName: string | undefined
}

type Column = {
  classYearId: Id<'classYears'>
  className: string
}

// A student is "moved" once its origin column differs from its current
// column; only moved entries are sent to the mutation on submit.
type Override = {
  studentId: Id<'students'>
  studentCode: string
  fullName: string
  saintName: string | undefined
  fromClassYearId: Id<'classYears'>
  toClassYearId: Id<'classYears'>
}

function RelocateStudentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const { selectedYearId } = useSelectedAcademicYear()
  const { isInactive, yearName } = useInactiveYear()

  const [columns, setColumns] = React.useState<Array<Column>>([])
  const [overrides, setOverrides] = React.useState<
    Partial<Record<Id<'students'>, Override>>
  >({})
  const [searchQuery, setSearchQuery] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const isDirty = Object.keys(overrides).length > 0

  React.useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Adding classes from a different year would mix rosters across years —
  // reset the board whenever the selected year changes.
  React.useEffect(() => {
    setColumns([])
    setOverrides({})
  }, [selectedYearId])

  const classYearOptions = useQuery(
    api.classes.listClassYears,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const addableClassYears = (classYearOptions ?? []).filter(
    (c) => !columns.some((col) => col.classYearId === c.classYearId),
  )
  const comboboxItems = addableClassYears.map((c) => ({
    label: c.className,
    value: c.classYearId,
  }))

  const addColumn = (classYearId: Id<'classYears'>) => {
    const option = addableClassYears.find((c) => c.classYearId === classYearId)
    if (!option) return
    setColumns((prev) => [
      ...prev,
      { classYearId, className: option.className },
    ])
    setSearchQuery('')
  }

  const removeColumn = (classYearId: Id<'classYears'>) => {
    setColumns((prev) => prev.filter((c) => c.classYearId !== classYearId))
    // Any student dragged into the removed column snaps back to its origin.
    setOverrides((prev) => {
      const next = { ...prev }
      for (const [studentId, override] of Object.entries(next) as Array<
        [Id<'students'>, Override]
      >) {
        if (override.toClassYearId === classYearId) {
          delete next[studentId]
        }
      }
      return next
    })
  }

  const moveStudent = (
    student: RosterStudent,
    originClassYearId: Id<'classYears'>,
    targetClassYearId: Id<'classYears'>,
  ) => {
    setOverrides((prev) => {
      const existing = prev[student.studentId]
      const fromClassYearId = existing?.fromClassYearId ?? originClassYearId
      if (fromClassYearId === targetClassYearId) {
        const next = { ...prev }
        delete next[student.studentId]
        return next
      }
      return {
        ...prev,
        [student.studentId]: {
          studentId: student.studentId,
          studentCode: student.studentCode,
          fullName: student.fullName,
          saintName: student.saintName,
          fromClassYearId,
          toClassYearId: targetClassYearId,
        },
      }
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const targetClassYearId = over.id as Id<'classYears'>
    const data = active.data.current as
      { student: RosterStudent; columnId: Id<'classYears'> } | undefined
    if (!data) return
    moveStudent(data.student, data.columnId, targetClassYearId)
  }

  const assignMutation = useMutation(api.students.assignStudentToClassYear)

  const handleSubmit = async () => {
    if (!requesterId) return
    const overrideList = Object.values(overrides).filter(
      (o): o is Override => o !== undefined,
    )
    if (overrideList.length === 0) {
      toast.error(t('students.relocate.noMoves'))
      return
    }

    const byTarget = new Map<Id<'classYears'>, Array<Id<'students'>>>()
    for (const o of overrideList) {
      const list = byTarget.get(o.toClassYearId) ?? []
      list.push(o.studentId)
      byTarget.set(o.toClassYearId, list)
    }

    setSubmitting(true)
    const enrolledDate = new Date().toLocaleDateString('sv-SE')
    let successCount = 0
    const committed: Array<Id<'students'>> = []
    for (const [targetClassYearId, studentIds] of byTarget) {
      try {
        await assignMutation({
          requesterId,
          studentIds,
          targetClassYearId,
          isPrimaryClass: true,
          enrolledDate,
          replaceExistingPrimary: true,
        })
        successCount += studentIds.length
        committed.push(...studentIds)
        const column = columns.find((c) => c.classYearId === targetClassYearId)
        toast.success(
          t('students.relocate.classSuccess', {
            count: studentIds.length,
            className: column?.className ?? '',
          }),
        )
      } catch (err) {
        const column = columns.find((c) => c.classYearId === targetClassYearId)
        toast.error(
          `${column?.className ?? ''}: ${translateConvexError(err, t, 'students.relocate.error')}`,
        )
      }
    }
    setSubmitting(false)

    if (committed.length > 0) {
      setOverrides((prev) => {
        const next = { ...prev }
        for (const id of committed) delete next[id]
        return next
      })
    }
    if (successCount === overrideList.length) {
      toast.success(t('students.relocate.submitSuccess'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Kanban}
        title={t('students.relocate.title')}
        subtitle={t('students.relocate.subtitle')}
      />

      {isInactive && (
        <Alert className="border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="size-4 shrink-0" />
          <AlertDescription>
            {t('students.relocate.inactiveYearWarning', {
              year: yearName ?? '',
            })}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <div className="w-72">
          <Combobox
            value={null as Id<'classYears'> | null}
            onValueChange={(val) => val && addColumn(val)}
            inputValue={searchQuery}
            onInputValueChange={setSearchQuery}
            items={comboboxItems}
            filter={null}
            disabled={isInactive || !selectedYearId}
          >
            <ComboboxInput
              placeholder={t('students.relocate.addClassPlaceholder')}
            />
            <ComboboxContent>
              <ComboboxList>
                {comboboxItems.map((item) => (
                  <ComboboxItem key={item.value} value={item.value}>
                    <PlusIcon className="size-3.5" />
                    {item.label}
                  </ComboboxItem>
                ))}
              </ComboboxList>
              <ComboboxEmpty>
                {t('students.relocate.noMoreClasses')}
              </ComboboxEmpty>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground border rounded-xl bg-card">
          {t('students.relocate.emptyState')}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <BoardColumn
                key={column.classYearId}
                column={column}
                requesterId={requesterId}
                overrides={overrides}
                onRemove={() => removeColumn(column.classYearId)}
                disabled={isInactive}
              />
            ))}
          </div>
        </DndContext>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">
          {t('students.relocate.movedCount', {
            count: Object.keys(overrides).length,
          })}
        </span>
        <Button
          onClick={handleSubmit}
          disabled={!isDirty || submitting || isInactive}
        >
          {submitting ? t('common.saving') : t('students.relocate.submit')}
        </Button>
      </div>
    </div>
  )
}

function BoardColumn({
  column,
  requesterId,
  overrides,
  onRemove,
  disabled,
}: {
  column: Column
  requesterId: Id<'catechists'> | undefined
  overrides: Partial<Record<Id<'students'>, Override>>
  onRemove: () => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: column.classYearId })

  const roster = useQuery(
    api.students.listActiveRosterByClassYear,
    requesterId ? { requesterId, classYearId: column.classYearId } : 'skip',
  )

  const cards = React.useMemo(() => {
    const result: Array<RosterStudent> = []
    for (const s of roster ?? []) {
      const override = overrides[s.studentId]
      if (override && override.toClassYearId !== column.classYearId) continue
      result.push(s)
    }
    for (const override of Object.values(overrides)) {
      if (!override) continue
      if (
        override.toClassYearId === column.classYearId &&
        override.fromClassYearId !== column.classYearId
      ) {
        result.push({
          studentId: override.studentId,
          studentCode: override.studentCode,
          fullName: override.fullName,
          saintName: override.saintName,
        })
      }
    }
    return result
  }, [roster, overrides, column.classYearId])

  return (
    <div
      ref={setNodeRef}
      className={`flex-none w-64 flex flex-col gap-2 rounded-xl border bg-card p-3 ${
        isOver ? 'ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold truncate">{column.className}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{cards.length}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('common.delete')}
            onClick={onRemove}
            disabled={disabled}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 min-h-24">
        {roster === undefined ? (
          <div className="h-16 bg-muted animate-pulse rounded-lg" />
        ) : cards.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            {t('students.relocate.columnEmpty')}
          </div>
        ) : (
          cards.map((student) => (
            <StudentCard
              key={student.studentId}
              student={student}
              columnId={column.classYearId}
              disabled={disabled}
              moved={
                overrides[student.studentId]?.toClassYearId ===
                column.classYearId
              }
            />
          ))
        )}
      </div>
    </div>
  )
}

function StudentCard({
  student,
  columnId,
  disabled,
  moved,
}: {
  student: RosterStudent
  columnId: Id<'classYears'>
  disabled: boolean
  moved: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `${columnId}:${student.studentId}`,
      data: { student, columnId },
      disabled,
    })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 10,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-50' : ''
      } ${moved ? 'border-primary' : ''}`}
    >
      <div className="font-medium truncate">
        {formatPersonName(student.saintName, student.fullName)}
      </div>
      <div className="text-xs text-muted-foreground">{student.studentCode}</div>
    </div>
  )
}
