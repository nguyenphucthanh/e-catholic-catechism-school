import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Edit2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

export const Route = createFileRoute('/_authenticated/assignments')({
  component: AssignmentsPage,
  staticData: { crumb: 'assignments.title' },
})

function AssignmentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const assignmentsData = useQuery(
    api.assignments.listYearAssignments,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  if (!assignmentsData) {
    return <div>{t('common.loading')}</div>
  }

  const isUserBoardMember = assignmentsData.boardMembers.catechistIds.includes(
    requesterId as Id<'catechists'>,
  )
  const canEdit = isAdmin(user) || isUserBoardMember
  const isInactive = !assignmentsData.academicYear.isActive

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        title={t('assignments.title')}
        subtitle={t('assignments.subtitle')}
        actions={
          !isInactive && canEdit ? (
            <Button size="sm" render={<Link to="/assignments/edit" />}>
              <Edit2 className="mr-2 size-4" />
              {t('assignments.edit.button')}
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="board" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="board">{t('assignments.tabs.board')}</TabsTrigger>
          <TabsTrigger value="branch">
            {t('assignments.tabs.branch')}
          </TabsTrigger>
          <TabsTrigger value="class">{t('assignments.tabs.class')}</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('assignments.board.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {assignmentsData.boardMembers.catechists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('assignments.board.empty')}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {assignmentsData.boardMembers.catechists.map((catechist) => (
                    <div
                      key={catechist._id}
                      className="flex items-center gap-3 rounded-lg border p-4"
                    >
                      <Avatar className="size-10">
                        <AvatarFallback>
                          {formatPersonName(
                            catechist.saintName,
                            catechist.fullName,
                          ).charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {formatPersonName(
                            catechist.saintName,
                            catechist.fullName,
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branch" className="mt-6">
          <div className="grid gap-4">
            {Object.entries(
              assignmentsData.branchHeads.byBranch as Record<
                string,
                {
                  branchName: string
                  catechists: Array<{ fullName: string; saintName?: string }>
                }
              >,
            ).map(([branchId, branchData]) => (
              <Card key={branchId}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {branchData.branchName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {branchData.catechists.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('assignments.branch.empty')}
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {branchData.catechists.map((catechist, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <Avatar className="size-9">
                            <AvatarFallback>
                              {formatPersonName(
                                catechist.saintName,
                                catechist.fullName,
                              ).charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {formatPersonName(
                                catechist.saintName,
                                catechist.fullName,
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="class" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('assignments.class.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {assignmentsData.classDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('assignments.class.empty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('classes.col.name')}</TableHead>
                        <TableHead>{t('assignments.class.homeroom')}</TableHead>
                        <TableHead>
                          {t('assignments.class.coTeachers')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentsData.classDetails.map((classDetail) => {
                        const teachers =
                          assignmentsData.classTeachers.byClass[
                            classDetail.classYearId
                          ]
                        const homeroom = teachers.homeroom
                        const coTeachers = teachers.coTeachers

                        return (
                          <TableRow key={classDetail.classYearId}>
                            <TableCell className="font-medium">
                              {classDetail.className}
                            </TableCell>
                            <TableCell>
                              {homeroom
                                ? formatPersonName(
                                    homeroom.catechist.saintName,
                                    homeroom.catechist.fullName,
                                  )
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {coTeachers.length === 0
                                ? '-'
                                : coTeachers
                                    .map((ct) =>
                                      formatPersonName(
                                        ct.catechist.saintName,
                                        ct.catechist.fullName,
                                      ),
                                    )
                                    .join(', ')}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
