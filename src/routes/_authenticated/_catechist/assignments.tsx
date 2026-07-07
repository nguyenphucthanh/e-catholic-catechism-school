import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Download, Edit2 } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { formatPersonName } from '~/lib/name'
import {
  exportBranchesPdf,
  exportClassesPdf,
  exportFullAssignmentsPdf,
} from '~/lib/export'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Label } from '~/components/ui/label'

export const Route = createFileRoute('/_authenticated/_catechist/assignments')({
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
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const boardMembers =
                  assignmentsData.boardMembers.catechists.map((c) => ({
                    fullName: c.fullName,
                    saintName: 'saintName' in c ? c.saintName : undefined,
                  }))

                const branchEntries = Object.entries(
                  assignmentsData.branchHeads.byBranch as Record<
                    string,
                    {
                      branchName: string
                      catechists: Array<{
                        fullName: string
                        saintName?: string
                      }>
                    }
                  >,
                ).sort(([aId], [bId]) => {
                  const aBranch = assignmentsData.activeBranches.find(
                    (b) => b._id === aId,
                  )
                  const bBranch = assignmentsData.activeBranches.find(
                    (b) => b._id === bId,
                  )
                  return (aBranch?.sortOrder ?? 0) - (bBranch?.sortOrder ?? 0)
                })

                const branchOrderByName = new Map<string, number>()
                for (const b of assignmentsData.activeBranches) {
                  branchOrderByName.set(b.name, b.sortOrder)
                }

                const classByBranch = new Map<
                  string,
                  Array<(typeof assignmentsData.classDetails)[number]>
                >()
                for (const cd of assignmentsData.classDetails) {
                  const group = classByBranch.get(cd.branchName) || []
                  group.push(cd)
                  classByBranch.set(cd.branchName, group)
                }

                const branches = branchEntries.map(([, data]) => {
                  const branchClasses =
                    classByBranch
                      .get(data.branchName)
                      ?.sort((a, b) => a.className.localeCompare(b.className))
                      .map((cd) => {
                        const teachers =
                          assignmentsData.classTeachers.byClass[cd.classYearId]
                        return {
                          className: cd.className,
                          homeroom: teachers.homeroom?.catechist ?? null,
                          coTeachers: teachers.coTeachers.map(
                            (ct) => ct.catechist,
                          ),
                        }
                      }) ?? []

                  return {
                    branchName: data.branchName,
                    branchHeads: data.catechists,
                    classes: branchClasses,
                  }
                })

                exportFullAssignmentsPdf(
                  boardMembers,
                  branches,
                  t('assignments.title'),
                  {
                    [t('academicYears.col.name')]:
                      assignmentsData.academicYear.name,
                  },
                  `${assignmentsData.academicYear.name}-assignments.pdf`,
                  {
                    boardMembers: t('assignments.board.title'),
                    branchHeadsPrefix: t('assignments.branch.title') + ': ',
                    classCol: t('assignments.export.pdf.classCol'),
                    homeroomCol: t('assignments.class.homeroom'),
                    coTeachersCol: t('assignments.class.coTeachers'),
                    noClasses: t('assignments.export.pdf.noClasses'),
                  },
                )
              }}
            >
              <Download className="mr-2 size-4" />
              {t('assignments.export.pdf.full')}
            </Button>
            {!isInactive && canEdit && (
              <Button size="sm" render={<Link to="/assignments/edit" />}>
                <Edit2 className="mr-2 size-4" />
                {t('assignments.edit.button')}
              </Button>
            )}
          </div>
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
                            'saintName' in catechist
                              ? catechist.saintName
                              : undefined,
                            catechist.fullName,
                          ).charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {formatPersonName(
                            'saintName' in catechist
                              ? catechist.saintName
                              : undefined,
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
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const branches = Object.entries(
                  assignmentsData.branchHeads.byBranch as Record<
                    string,
                    {
                      branchName: string
                      catechists: Array<{
                        fullName: string
                        saintName?: string
                      }>
                    }
                  >,
                )
                  .sort(([aId], [bId]) => {
                    const aBranch = assignmentsData.activeBranches.find(
                      (b) => b._id === aId,
                    )
                    const bBranch = assignmentsData.activeBranches.find(
                      (b) => b._id === bId,
                    )
                    return (aBranch?.sortOrder ?? 0) - (bBranch?.sortOrder ?? 0)
                  })
                  .map(([_, data]) => ({
                    branchName: data.branchName,
                    branchHeads: data.catechists,
                  }))
                exportBranchesPdf(
                  branches,
                  t('assignments.title'),
                  {
                    [t('academicYears.col.name')]:
                      assignmentsData.academicYear.name,
                  },
                  `${assignmentsData.academicYear.name}-branches.pdf`,
                  {
                    branchCol: t('assignments.export.pdf.branchCol'),
                    branchHeadsCol: t('assignments.export.pdf.branchHeadsCol'),
                  },
                )
              }}
            >
              <Download className="mr-2 size-4" />
              {t('assignments.export.pdf.branch')}
            </Button>
          </div>
          <div className="grid gap-4">
            {Object.entries(
              assignmentsData.branchHeads.byBranch as Record<
                string,
                {
                  branchName: string
                  catechists: Array<{ fullName: string; saintName?: string }>
                }
              >,
            )
              .sort(([aId], [bId]) => {
                const aBranch = assignmentsData.activeBranches.find(
                  (b) => b._id === aId,
                )
                const bBranch = assignmentsData.activeBranches.find(
                  (b) => b._id === bId,
                )
                return (aBranch?.sortOrder ?? 0) - (bBranch?.sortOrder ?? 0)
              })
              .map(([branchId, branchData]) => (
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
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const branchOrderByName = new Map<string, number>()
                for (const b of assignmentsData.activeBranches) {
                  branchOrderByName.set(b.name, b.sortOrder)
                }
                const classByBranch = new Map<
                  string,
                  Array<(typeof assignmentsData.classDetails)[number]>
                >()
                for (const cd of assignmentsData.classDetails) {
                  const group = classByBranch.get(cd.branchName) || []
                  group.push(cd)
                  classByBranch.set(cd.branchName, group)
                }
                const sortedBranchNames = [...classByBranch.keys()].sort(
                  (a, b) =>
                    (branchOrderByName.get(a) ?? 0) -
                    (branchOrderByName.get(b) ?? 0),
                )
                const branchGroups = sortedBranchNames.map((branchName) => {
                  const classes = classByBranch
                    .get(branchName)!
                    .sort((a, b) => a.className.localeCompare(b.className))
                    .map((cd) => {
                      const teachers =
                        assignmentsData.classTeachers.byClass[cd.classYearId]
                      return {
                        className: cd.className,
                        homeroom: teachers.homeroom?.catechist ?? null,
                        coTeachers: teachers.coTeachers.map(
                          (ct) => ct.catechist,
                        ),
                      }
                    })
                  return { branchName, classes }
                })
                exportClassesPdf(
                  branchGroups,
                  t('assignments.title'),
                  {
                    [t('academicYears.col.name')]:
                      assignmentsData.academicYear.name,
                  },
                  `${assignmentsData.academicYear.name}-classes.pdf`,
                  {
                    classCol: t('assignments.export.pdf.classCol'),
                    homeroomCol: t('assignments.class.homeroom'),
                    coTeachersCol: t('assignments.class.coTeachers'),
                  },
                )
              }}
            >
              <Download className="mr-2 size-4" />
              {t('assignments.export.pdf.class')}
            </Button>
          </div>
          {(() => {
            const branchOrderByName = new Map<string, number>()
            for (const b of assignmentsData.activeBranches) {
              branchOrderByName.set(b.name, b.sortOrder)
            }
            const classByBranch = new Map<
              string,
              Array<(typeof assignmentsData.classDetails)[number]>
            >()
            for (const cd of assignmentsData.classDetails) {
              const group = classByBranch.get(cd.branchName) || []
              group.push(cd)
              classByBranch.set(cd.branchName, group)
            }
            const sortedBranchNames = [...classByBranch.keys()].sort(
              (a, b) =>
                (branchOrderByName.get(a) ?? 0) -
                (branchOrderByName.get(b) ?? 0),
            )

            if (sortedBranchNames.length === 0) {
              return (
                <p className="text-sm text-muted-foreground">
                  {t('assignments.class.empty')}
                </p>
              )
            }

            return (
              <div className="space-y-6">
                {sortedBranchNames.map((branchName) => {
                  const classes = classByBranch
                    .get(branchName)!
                    .sort((a, b) => a.className.localeCompare(b.className))

                  return (
                    <Card key={branchName}>
                      <CardHeader>
                        <CardTitle className="text-lg">{branchName}</CardTitle>
                      </CardHeader>
                      <CardContent className="md:grid grid-cols-3 gap-4">
                        {classes.map((classDetail) => {
                          const teachers =
                            assignmentsData.classTeachers.byClass[
                              classDetail.classYearId
                            ]
                          const homeroom = teachers.homeroom
                          const coTeachers = teachers.coTeachers

                          return (
                            <Card key={classDetail.classYearId}>
                              <CardHeader>
                                <CardTitle>{classDetail.className}</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <Label>{t('assignments.class.homeroom')}</Label>
                                <div className="pl-4">
                                  {homeroom ? (
                                    <div className="flex items-center gap-2">
                                      <Avatar className={'size-9'}>
                                        <AvatarFallback>
                                          {formatPersonName(
                                            'saintName' in homeroom.catechist
                                              ? homeroom.catechist.saintName
                                              : undefined,
                                            homeroom.catechist.fullName,
                                          ).charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      {formatPersonName(
                                        homeroom.catechist.saintName,
                                        homeroom.catechist.fullName,
                                      )}
                                    </div>
                                  ) : (
                                    '-'
                                  )}
                                </div>
                                <Label>
                                  {t('assignments.class.coTeachers')}
                                </Label>
                                <div className="pl-4">
                                  {coTeachers.length === 0
                                    ? '-'
                                    : coTeachers.map((ct) => (
                                        <div
                                          key={ct.catechist._id}
                                          className="flex items-center gap-4"
                                        >
                                          <Avatar className="size-9">
                                            <AvatarFallback>
                                              {formatPersonName(
                                                ct.catechist.saintName,
                                                ct.catechist.fullName,
                                              ).charAt(0)}
                                            </AvatarFallback>
                                          </Avatar>
                                          {formatPersonName(
                                            ct.catechist.saintName,
                                            ct.catechist.fullName,
                                          )}
                                        </div>
                                      ))}
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
