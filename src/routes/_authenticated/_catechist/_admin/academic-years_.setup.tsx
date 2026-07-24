import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  ArrowBigUpDash,
  CalendarRange,
  CheckCircle2,
  Circle,
  GraduationCap,
  Layers,
  Plus,
  Sparkles,
  Upload,
  UserCog,
} from 'lucide-react'
import * as React from 'react'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '~/components/ui/progress'
import { Badge } from '~/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/academic-years_/setup',
)({
  component: AcademicYearSetupPage,
  staticData: {
    crumbs: [
      { label: 'nav.admin' },
      { label: 'academicYears.title', path: '/academic-years' },
      { label: 'academicYears.setup.title' },
    ],
  },
})

function AcademicYearSetupPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  // Guard for admin access
  if (!user || !isAdmin(user)) {
    return <Navigate to="/dashboard" />
  }

  const requesterId = user.userDocId as Id<'catechists'>

  // Fetch years list
  const academicYears = useQuery(
    api.academicYears.list,
    requesterId ? { requesterId } : 'skip',
  )

  // Fetch active year
  const activeYear = useQuery(
    api.academicYears.getActive,
    requesterId ? { requesterId } : 'skip',
  )

  // Fetch stats for the active academic year
  const orgStats = useQuery(
    api.orgStats.getOrgStats,
    requesterId && activeYear
      ? { requesterId, academicYearId: activeYear._id }
      : 'skip',
  )

  // Fetch branches to warn if none exist before creating classes
  const branches = useQuery(
    api.branches.list,
    requesterId ? { requesterId } : 'skip',
  )
  const noBranches = branches !== undefined && branches.length === 0

  // Find the latest academic year by start date
  const latestYear = React.useMemo(() => {
    if (!academicYears || academicYears.length === 0) return null
    return [...academicYears].sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    )[0]
  }, [academicYears])

  // Step 1: Create a new academic year
  // Complete if there is at least one academic year in the list
  const step1Done = academicYears !== undefined && academicYears.length > 0

  // Step 2: Make new year active
  // Complete if the latest academic year created is the active year
  const step2Done =
    activeYear !== undefined &&
    latestYear !== null &&
    activeYear !== null &&
    activeYear._id === latestYear._id

  // Step 3: Bulk create classes
  // Complete if active year has classes
  const step3Done = orgStats !== undefined && orgStats.totalClasses > 0

  // Step 4: Promote students
  // Complete if active year has students
  const step4Done = orgStats !== undefined && orgStats.totalStudents > 0

  // Step 5: Assign catechists
  // Complete if active year has catechists
  const step5Done = orgStats !== undefined && orgStats.totalCatechists > 0

  const stepsData = [
    { done: step1Done, label: 1 },
    { done: step2Done, label: 2 },
    { done: step3Done, label: 3 },
    { done: step4Done, label: 4 },
    { done: step5Done, label: 5 },
  ]
  const completedCount = stepsData.filter((s) => s.done).length
  const progressPercent = (completedCount / 5) * 100

  const isLoading =
    academicYears === undefined ||
    activeYear === undefined ||
    (activeYear !== null && orgStats === undefined)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Sparkles}
        title={t('academicYears.setup.title')}
        subtitle={t('academicYears.setup.subtitle')}
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-full bg-muted animate-pulse rounded-md" />
          <div className="space-y-3 mt-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-28 bg-card border animate-pulse rounded-xl"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress Card */}
          <Card className="bg-primary/5 border-primary/10 overflow-hidden relative">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-semibold text-primary">
                  {t('academicYears.setup.progress')}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20"
                >
                  {completedCount} / 5
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercent} className="w-full">
                <ProgressLabel className="sr-only">
                  {t('academicYears.setup.progress')}
                </ProgressLabel>
                <ProgressValue className="sr-only" />
              </Progress>
            </CardContent>
          </Card>

          {/* Steps List */}
          <div className="space-y-4">
            {/* Step 1 */}
            <Card
              className={`transition-all duration-200 ${
                step1Done
                  ? 'bg-card/50 opacity-90 border-muted'
                  : 'border-primary/30 ring-1 ring-primary/10 bg-primary/[0.01]'
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="mt-1">
                  {step1Done ? (
                    <CheckCircle2 className="size-6 text-green-500 fill-green-500/10 shrink-0" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('academicYears.setup.step', { number: 1 })}
                    </span>
                    <Badge
                      variant={step1Done ? 'secondary' : 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {step1Done
                        ? t('academicYears.setup.status.complete')
                        : t('academicYears.setup.status.incomplete')}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {t('academicYears.setup.step1.title')}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('academicYears.setup.step1.description')}
                  </CardDescription>
                  {latestYear && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('academicYears.col.name')}:{' '}
                      <span className="font-semibold text-foreground">
                        {latestYear.name}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={step1Done ? 'outline' : 'default'}
                  nativeButton={false}
                  render={<Link to="/academic-years/create" />}
                  className="shrink-0"
                >
                  <Plus className="size-4 mr-2" />
                  {t('academicYears.setup.step1.action')}
                </Button>
              </CardHeader>
            </Card>

            {/* Step 2 */}
            <Card
              className={`transition-all duration-200 ${
                step2Done
                  ? 'bg-card/50 opacity-90 border-muted'
                  : !step1Done
                    ? 'opacity-60 bg-muted/10'
                    : 'border-primary/30 ring-1 ring-primary/10 bg-primary/[0.01]'
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="mt-1">
                  {step2Done ? (
                    <CheckCircle2 className="size-6 text-green-500 fill-green-500/10 shrink-0" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('academicYears.setup.step', { number: 2 })}
                    </span>
                    <Badge
                      variant={step2Done ? 'secondary' : 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {step2Done
                        ? t('academicYears.setup.status.complete')
                        : t('academicYears.setup.status.incomplete')}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {t('academicYears.setup.step2.title')}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('academicYears.setup.step2.description', {
                      activeYear: activeYear
                        ? activeYear.name
                        : t('academicYears.status.inactive'),
                    })}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant={step2Done ? 'outline' : 'default'}
                  nativeButton={false}
                  render={<Link to="/academic-years" />}
                  className="shrink-0"
                  disabled={!step1Done}
                >
                  <CalendarRange className="size-4 mr-2" />
                  {t('academicYears.setup.step2.action')}
                </Button>
              </CardHeader>
            </Card>

            {/* Step 3 */}
            <Card
              className={`transition-all duration-200 ${
                step3Done
                  ? 'bg-card/50 opacity-90 border-muted'
                  : !step2Done
                    ? 'opacity-60 bg-muted/10'
                    : 'border-primary/30 ring-1 ring-primary/10 bg-primary/[0.01]'
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="mt-1">
                  {step3Done ? (
                    <CheckCircle2 className="size-6 text-green-500 fill-green-500/10 shrink-0" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('academicYears.setup.step', { number: 3 })}
                    </span>
                    <Badge
                      variant={step3Done ? 'secondary' : 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {step3Done
                        ? t('academicYears.setup.status.complete')
                        : t('academicYears.setup.status.incomplete')}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {t('academicYears.setup.step3.title')}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('academicYears.setup.step3.description', {
                      count: orgStats ? orgStats.totalClasses : 0,
                    })}
                  </CardDescription>
                  {noBranches && !step3Done && (
                    <div className="text-xs text-destructive mt-1">
                      {t(
                        'classes.noBranch.description',
                        'Cần tạo ngành trước khi tạo lớp.',
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {noBranches && !step3Done && (
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link to="/branches/create" />}
                      disabled={!step2Done}
                    >
                      <Layers className="size-4 mr-2" />
                      {t('classes.noBranch.action', 'Tạo ngành')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={step3Done ? 'outline' : 'default'}
                    nativeButton={false}
                    render={<Link to="/classes/bulk-create" />}
                    disabled={!step2Done}
                  >
                    <GraduationCap className="size-4 mr-2" />
                    {t('academicYears.setup.step3.action')}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Step 4 */}
            <Card
              className={`transition-all duration-200 ${
                step4Done
                  ? 'bg-card/50 opacity-90 border-muted'
                  : !step3Done
                    ? 'opacity-60 bg-muted/10'
                    : 'border-primary/30 ring-1 ring-primary/10 bg-primary/[0.01]'
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="mt-1">
                  {step4Done ? (
                    <CheckCircle2 className="size-6 text-green-500 fill-green-500/10 shrink-0" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('academicYears.setup.step', { number: 4 })}
                    </span>
                    <Badge
                      variant={step4Done ? 'secondary' : 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {step4Done
                        ? t('academicYears.setup.status.complete')
                        : t('academicYears.setup.status.incomplete')}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {t('academicYears.setup.step4.title')}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('academicYears.setup.step4.description', {
                      count: orgStats ? orgStats.totalStudents : 0,
                    })}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant={step4Done ? 'outline' : 'default'}
                  nativeButton={false}
                  render={<Link to="/students/promote" />}
                  className="shrink-0"
                  disabled={!step3Done}
                >
                  <ArrowBigUpDash className="size-4 mr-2" />
                  {t('academicYears.setup.step4.action')}
                </Button>
              </CardHeader>
            </Card>

            {/* Step 5 */}
            <Card
              className={`transition-all duration-200 ${
                step5Done
                  ? 'bg-card/50 opacity-90 border-muted'
                  : !step3Done
                    ? 'opacity-60 bg-muted/10'
                    : 'border-primary/30 ring-1 ring-primary/10 bg-primary/[0.01]'
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="mt-1">
                  {step5Done ? (
                    <CheckCircle2 className="size-6 text-green-500 fill-green-500/10 shrink-0" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('academicYears.setup.step', { number: 5 })}
                    </span>
                    <Badge
                      variant={step5Done ? 'secondary' : 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {step5Done
                        ? t('academicYears.setup.status.complete')
                        : t('academicYears.setup.status.incomplete')}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {t('academicYears.setup.step5.title')}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('academicYears.setup.step5.description', {
                      count: orgStats ? orgStats.totalCatechists : 0,
                    })}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant={step5Done ? 'outline' : 'default'}
                  nativeButton={false}
                  render={<Link to="/assignments/edit" />}
                  className="shrink-0"
                  disabled={!step3Done}
                >
                  <UserCog className="size-4 mr-2" />
                  {t('academicYears.setup.step5.action')}
                </Button>
              </CardHeader>
            </Card>
          </div>

          {/* Import Tip Banner */}
          <Alert className="bg-muted/30 border-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <Upload className="size-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <AlertTitle className="font-semibold">
                  {t('academicYears.setup.importTip.title')}
                </AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground">
                  {t('academicYears.setup.importTip.description')}
                </AlertDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to="/import" />}
              className="shrink-0"
            >
              {t('academicYears.setup.importTip.action')}
            </Button>
          </Alert>
        </div>
      )}
    </div>
  )
}
