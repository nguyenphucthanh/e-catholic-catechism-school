import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import React from 'react'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { isAdmin } from '~/lib/permissions'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '~/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

export const Route = createFileRoute(
  '/_authenticated/_catechist/assignments_/edit',
)({
  component: AssignmentsEditPage,
  staticData: {
    crumbs: [
      {
        path: '/assignments',
        label: 'assignments.title',
      },
      {
        label: 'assignments.edit.title',
      },
    ],
  },
})

function AssignmentsEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const assignmentsData = useQuery(
    api.assignments.listYearAssignments,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const updateBoard = useMutation(api.assignments.updateBoardAssignments)
  const updateBranch = useMutation(api.assignments.updateBranchAssignments)
  const updateClass = useMutation(api.assignments.updateClassAssignments)

  // Redirect if inactive year
  React.useEffect(() => {
    if (assignmentsData && !assignmentsData.academicYear.isActive) {
      toast.error(t('assignments.redirected'))
      navigate({ to: '/assignments' })
    }
  }, [assignmentsData, t, navigate])

  // Form states
  const [boardMembers, setBoardMembers] = React.useState<
    Array<Id<'catechists'>>
  >([])
  const [branchHeads, setBranchHeads] = React.useState<
    Record<Id<'branches'>, Array<Id<'catechists'>> | undefined>
  >({})
  const [classTeachers, setClassTeachers] = React.useState<
    Record<
      Id<'classYears'>,
      | {
          homeroom: Id<'catechists'> | null
          coTeachers: Array<Id<'catechists'>>
        }
      | undefined
    >
  >({})

  // Initialize form states from data
  React.useEffect(() => {
    if (assignmentsData) {
      setBoardMembers(assignmentsData.boardMembers.catechistIds)

      const branchHeadsMap: Record<Id<'branches'>, Array<Id<'catechists'>>> = {}
      assignmentsData.activeBranches.forEach((branch) => {
        branchHeadsMap[branch._id] =
          assignmentsData.branchHeads.byBranch[branch._id]?.catechistIds || []
      })
      setBranchHeads(branchHeadsMap)

      const classTeachersMap: Record<
        Id<'classYears'>,
        {
          homeroom: Id<'catechists'> | null
          coTeachers: Array<Id<'catechists'>>
        }
      > = {}
      assignmentsData.classDetails.forEach((classDetail) => {
        const teachers =
          assignmentsData.classTeachers.byClass[classDetail.classYearId]
        classTeachersMap[classDetail.classYearId] = {
          homeroom: teachers.homeroom?.catechistId || null,
          coTeachers: teachers.coTeachers.map((ct) => ct.catechistId),
        }
      })
      setClassTeachers(classTeachersMap)
    }
  }, [assignmentsData])

  if (!assignmentsData) {
    return <div>{t('common.loading')}</div>
  }

  const isUserBoardMember = assignmentsData.boardMembers.catechistIds.includes(
    requesterId as Id<'catechists'>,
  )
  const canEdit = isAdmin(user) || isUserBoardMember
  if (!canEdit) {
    navigate({ to: '/assignments' })
    return null
  }

  const catechistOptions = assignmentsData.activeCatechists.map((c) => ({
    label: c.fullName,
    value: c._id,
  }))

  const getCatechistLabel = (id: Id<'catechists'> | ''): string =>
    catechistOptions.find((opt) => opt.value === id)?.label || ''

  const handleSaveBoard = async () => {
    if (!requesterId || !selectedYearId) return
    try {
      await updateBoard({
        requesterId,
        academicYearId: selectedYearId,
        catechistIds: boardMembers,
      })
      toast.success(t('assignments.saved.board'))
    } catch (err) {
      toast.error(translateConvexError(err, t))
    }
  }

  const handleSaveBranch = async (branchId: Id<'branches'>) => {
    if (!requesterId || !selectedYearId) return
    try {
      await updateBranch({
        requesterId,
        academicYearId: selectedYearId,
        branchId,
        catechistIds: branchHeads[branchId] || [],
      })
      toast.success(t('assignments.saved.branch'))
    } catch (err) {
      toast.error(translateConvexError(err, t))
    }
  }

  const handleSaveClass = async (classYearId: Id<'classYears'>) => {
    if (!requesterId || !selectedYearId) return
    const teachers = classTeachers[classYearId]
    try {
      await updateClass({
        requesterId,
        academicYearId: selectedYearId,
        classYearId,
        homeroomCatechistId: teachers?.homeroom || null,
        coTeacherCatechistIds: teachers?.coTeachers || [],
      })
      toast.success(t('assignments.saved.class'))
    } catch (err) {
      toast.error(translateConvexError(err, t))
    }
  }

  const coTeacherOptions = (classYearId: Id<'classYears'>) => {
    const homeroom = classTeachers[classYearId]?.homeroom
    return catechistOptions
      .filter((opt) => !homeroom || opt.value !== homeroom)
      .map((opt) => opt.value)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        title={t('assignments.edit.title')}
        subtitle={t('assignments.subtitle')}
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
            <CardContent className="space-y-4">
              <Combobox
                value={boardMembers}
                onValueChange={setBoardMembers}
                items={catechistOptions.map((opt) => opt.value)}
                multiple
                itemToStringLabel={getCatechistLabel}
                autoHighlight
              >
                <ComboboxChips>
                  <ComboboxValue>
                    {(values) => (
                      <>
                        {values.map((id) => {
                          const catechist =
                            assignmentsData.activeCatechists.find(
                              (c) => c._id === id,
                            )
                          return (
                            <ComboboxChip key={id}>
                              {catechist?.fullName || 'Unknown'}
                            </ComboboxChip>
                          )
                        })}
                        <ComboboxChipsInput />
                      </>
                    )}
                  </ComboboxValue>
                </ComboboxChips>
                <ComboboxContent>
                  <ComboboxEmpty>{t('common.noResultsFound')}</ComboboxEmpty>
                  <ComboboxList>
                    {(id: Id<'catechists'>) => (
                      <ComboboxItem key={id} value={id}>
                        {getCatechistLabel(id)}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <Button onClick={handleSaveBoard} className="mt-4">
                {t('assignments.class.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branch" className="mt-6">
          <div className="grid gap-4">
            {assignmentsData.activeBranches.map((branch) => (
              <Card key={branch._id}>
                <CardHeader>
                  <CardTitle className="text-lg">{branch.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Combobox
                    value={branchHeads[branch._id] || []}
                    onValueChange={(val) =>
                      setBranchHeads((prev) => ({
                        ...prev,
                        [branch._id]: val,
                      }))
                    }
                    items={catechistOptions.map((opt) => opt.value)}
                    multiple
                    itemToStringLabel={getCatechistLabel}
                    autoHighlight
                  >
                    <ComboboxChips>
                      <ComboboxValue>
                        {(values) => (
                          <>
                            {values.map((id) => {
                              const catechist =
                                assignmentsData.activeCatechists.find(
                                  (c) => c._id === id,
                                )
                              return (
                                <ComboboxChip key={id}>
                                  {catechist?.fullName || 'Unknown'}
                                </ComboboxChip>
                              )
                            })}
                            <ComboboxChipsInput
                              placeholder={t(
                                'assignments.branch.selectCatechists',
                              )}
                            />
                          </>
                        )}
                      </ComboboxValue>
                    </ComboboxChips>
                    <ComboboxContent>
                      <ComboboxEmpty>
                        {t('common.noResultsFound')}
                      </ComboboxEmpty>
                      <ComboboxList>
                        {(id: Id<'catechists'>) => (
                          <ComboboxItem key={id} value={id}>
                            {getCatechistLabel(id)}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <Button
                    onClick={() => handleSaveBranch(branch._id)}
                    className="mt-4"
                  >
                    {t('assignments.class.save')}
                  </Button>
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
                        <TableHead>{t('assignments.class.save')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentsData.classDetails.map((classDetail) => {
                        const teachers = classTeachers[classDetail.classYearId]

                        return (
                          <TableRow key={classDetail.classYearId}>
                            <TableCell className="font-medium">
                              {classDetail.className}
                            </TableCell>
                            <TableCell>
                              <Combobox
                                value={teachers?.homeroom || ''}
                                onValueChange={(val) =>
                                  setClassTeachers((prev) => ({
                                    ...prev,
                                    [classDetail.classYearId]: {
                                      homeroom: (val ||
                                        null) as Id<'catechists'> | null,
                                      coTeachers: teachers?.coTeachers || [],
                                    },
                                  }))
                                }
                                items={
                                  [
                                    '',
                                    ...catechistOptions.map((opt) => opt.value),
                                  ] as Array<Id<'catechists'> | ''>
                                }
                                itemToStringLabel={(item: string) =>
                                  item === ''
                                    ? 'None'
                                    : getCatechistLabel(
                                        item as Id<'catechists'>,
                                      )
                                }
                                autoHighlight
                              >
                                <ComboboxInput
                                  placeholder="Select..."
                                  className="w-full"
                                />
                                <ComboboxContent>
                                  <ComboboxEmpty>
                                    {t('common.noResultsFound')}
                                  </ComboboxEmpty>
                                  <ComboboxList>
                                    {(id: Id<'catechists'> | '') => (
                                      <ComboboxItem
                                        key={id || 'none'}
                                        value={id}
                                      >
                                        {id === ''
                                          ? 'None'
                                          : getCatechistLabel(id)}
                                      </ComboboxItem>
                                    )}
                                  </ComboboxList>
                                </ComboboxContent>
                              </Combobox>
                            </TableCell>
                            <TableCell>
                              <Combobox
                                value={teachers?.coTeachers || []}
                                onValueChange={(val) =>
                                  setClassTeachers((prev) => ({
                                    ...prev,
                                    [classDetail.classYearId]: {
                                      homeroom: teachers?.homeroom || null,
                                      coTeachers: val,
                                    },
                                  }))
                                }
                                items={coTeacherOptions(
                                  classDetail.classYearId,
                                )}
                                multiple
                                itemToStringLabel={getCatechistLabel}
                                autoHighlight
                              >
                                <ComboboxChips>
                                  <ComboboxValue>
                                    {(values) => (
                                      <>
                                        {values.map((id) => {
                                          const catechist =
                                            assignmentsData.activeCatechists.find(
                                              (c) => c._id === id,
                                            )
                                          return (
                                            <ComboboxChip key={id}>
                                              {catechist?.fullName || 'Unknown'}
                                            </ComboboxChip>
                                          )
                                        })}
                                        <ComboboxChipsInput />
                                      </>
                                    )}
                                  </ComboboxValue>
                                </ComboboxChips>
                                <ComboboxContent>
                                  <ComboboxEmpty>
                                    {t('common.noResultsFound')}
                                  </ComboboxEmpty>
                                  <ComboboxList>
                                    {(id: Id<'catechists'>) => (
                                      <ComboboxItem key={id} value={id}>
                                        {getCatechistLabel(id)}
                                      </ComboboxItem>
                                    )}
                                  </ComboboxList>
                                </ComboboxContent>
                              </Combobox>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleSaveClass(classDetail.classYearId)
                                }
                              >
                                {t('assignments.class.save')}
                              </Button>
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
