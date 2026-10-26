import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { TableColumnDef } from '~/components/custom/data-table'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { translateConvexError } from '~/lib/convex-errors'
import { formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { MeetingScopeBadge } from '~/components/custom/meeting-scope-badge'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { MeetingDeleteDialog } from '~/components/custom/meeting-delete-dialog'

export const Route = createFileRoute('/_authenticated/_catechist/meetings')({
  component: MeetingsPage,
  staticData: { crumb: 'meetings.title' },
})

type Meeting = FunctionReturnType<
  typeof api.catechistMeetings.listMeetings
>[number]

function MeetingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  // ponytail: list is client-side searched/sorted; one year holds few meetings.
  const meetings = useQuery(
    api.catechistMeetings.listMeetings,
    requesterId && selectedYearId ? { academicYearId: selectedYearId } : 'skip',
  )
  const perms = useQuery(
    api.catechistPermissions.getPermissions,
    requesterId && selectedYearId ? { academicYearId: selectedYearId } : 'skip',
  )
  const canCreate = !!perms && (perms.isAdmin || perms.isBoardMember)
  const cancelMeeting = useMutation(api.catechistMeetings.cancelMeeting)
  const [deleteTarget, setDeleteTarget] = React.useState<Meeting | null>(null)

  const onCancelMeeting = async (m: Meeting) => {
    if (!requesterId) return
    try {
      await cancelMeeting({ meetingId: m._id })
      toast.success(t('meetings.cancelled'))
    } catch (err) {
      toast.error(translateConvexError(err, t))
    }
  }

  const columns: Array<TableColumnDef<Meeting>> = [
    {
      accessorKey: 'title',
      header: t('meetings.fields.title'),
      cell: ({ row }) => (
        <Link
          to="/meetings/$id"
          params={{ id: row.original._id }}
          className="text-primary hover:underline font-medium"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: 'meetingDate',
      header: t('meetings.fields.meetingDate'),
      cell: ({ row }) => formatDate(row.original.meetingDate),
    },
    {
      accessorKey: 'scope',
      header: t('meetings.fields.scope'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <MeetingScopeBadge
            scope={row.original.scope}
            branchName={row.original.branchName}
          />
          {row.original.isCancelled && (
            <Badge variant="destructive">{t('meetings.cancelledBadge')}</Badge>
          )}
        </div>
      ),
    },
    { accessorKey: 'location', header: t('meetings.fields.location') },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const m = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('common.moreActions')}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                render={<Link to="/meetings/$id" params={{ id: m._id }} />}
              >
                {t('common.view')}
              </DropdownMenuItem>
              {m.canRecord && !m.isCancelled && (
                <DropdownMenuItem
                  render={
                    <Link
                      to="/attendance/catechists"
                      search={{
                        category: 'meeting',
                        date: m.meetingDate,
                        meetingId: m._id,
                      }}
                    />
                  }
                >
                  {t('meetings.takeAttendance')}
                </DropdownMenuItem>
              )}
              {m.canManage && (
                <>
                  <DropdownMenuItem
                    render={
                      <Link to="/meetings/$id/edit" params={{ id: m._id }} />
                    }
                  >
                    {t('common.edit')}
                  </DropdownMenuItem>
                  {!m.isCancelled && (
                    <DropdownMenuItem onClick={() => onCancelMeeting(m)}>
                      {t('meetings.cancel.action')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                    onClick={() => setDeleteTarget(m)}
                  >
                    {t('common.delete')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarClock}
        title={t('meetings.title')}
        subtitle={t('meetings.subtitle')}
        actions={
          canCreate && (
            <Button
              nativeButton={false}
              render={<Link to="/meetings/create" />}
            >
              <Plus className="size-4" />
              {t('meetings.actions.create')}
            </Button>
          )
        }
      />

      <div className="bg-card border rounded-xl p-4">
        <DataTable
          columns={columns}
          data={meetings ?? []}
          getRowId={(m) => m._id}
          searchColumnKey="title"
          searchPlaceholder={t('meetings.searchPlaceholder')}
          isLoading={meetings === undefined}
        />
      </div>

      {requesterId && (
        <MeetingDeleteDialog
          meeting={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
