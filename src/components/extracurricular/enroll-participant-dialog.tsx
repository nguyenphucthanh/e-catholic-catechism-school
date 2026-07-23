import { useMutation, useQuery } from 'convex/react'
import { Search, UserPlus, X } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Spinner } from '~/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { translateConvexError } from '~/lib/convex-errors'
import { formatPersonName } from '~/lib/name'

interface EnrollParticipantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: Id<'extracurricularPrograms'>
  targetScope: 'catechist' | 'student' | 'all'
  requesterId: Id<'catechists'>
}

export function EnrollParticipantDialog({
  open,
  onOpenChange,
  programId,
  targetScope,
  requesterId,
}: EnrollParticipantDialogProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = React.useState<'catechist' | 'student'>(
    targetScope === 'student' ? 'student' : 'catechist',
  )
  const [searchQuery, setSearchQuery] = React.useState('')
  const [enrollingId, setEnrollingId] = React.useState<string | null>(null)

  // Reset tab when targetScope or open changes
  React.useEffect(() => {
    if (open) {
      setActiveTab(targetScope === 'student' ? 'student' : 'catechist')
      setSearchQuery('')
    }
  }, [open, targetScope])

  const candidates = useQuery(
    api.extracurricularPrograms.searchEligibleCandidates,
    open && requesterId && searchQuery.trim().length >= 2
      ? {
          programId,
          requesterId,
          type: activeTab,
          search: searchQuery,
        }
      : 'skip',
  )

  const enrollParticipant = useMutation(
    api.extracurricularPrograms.enrollParticipant,
  )

  const handleEnroll = async (
    targetId: string,
    targetType: 'catechist' | 'student',
  ) => {
    setEnrollingId(targetId)
    try {
      await enrollParticipant({
        programId,
        requesterId,
        targetType,
        targetId,
      })
      toast.success(t('extracurricular.enrolledSuccess'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
    } finally {
      setEnrollingId(null)
    }
  }

  const showTabs = targetScope === 'all'
  const isSearchTooShort = searchQuery.trim().length < 2

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full sm:max-w-3xl flex-col gap-4 overflow-hidden p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t('extracurricular.enrollOthersTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('extracurricular.enrollOthersDesc')}
          </DialogDescription>
        </DialogHeader>

        {showTabs && (
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as 'catechist' | 'student')
              setSearchQuery('')
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="catechist">
                {t('extracurricular.type.catechist')}
              </TabsTrigger>
              <TabsTrigger value="student">
                {t('extracurricular.type.student')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'catechist'
                ? t('extracurricular.searchCatechistPlaceholder')
                : t('extracurricular.searchStudentPlaceholder')
            }
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto rounded-md border min-h-[300px] max-h-[420px]">
          {isSearchTooShort ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground min-h-[280px]">
              <Search className="mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium">
                {t('extracurricular.searchMinCharsPrompt')}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                {t('extracurricular.searchMinCharsSubtext')}
              </p>
            </div>
          ) : !candidates ? (
            <div className="flex items-center justify-center p-12 min-h-[280px]">
              <Spinner className="h-6 w-6 text-primary" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground min-h-[280px]">
              <p className="font-medium">
                {t('extracurricular.noCandidatesFound')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {candidates.map((candidate) => {
                const name = formatPersonName(
                  candidate.saintName,
                  candidate.fullName,
                )
                const initial = candidate.fullName.charAt(0).toUpperCase()
                const isEnrolling = enrollingId === candidate.id

                return (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback className="text-xs font-semibold">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground text-sm">
                          {name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {candidate.code && (
                            <span className="text-xs text-muted-foreground">
                              {candidate.code}
                            </span>
                          )}
                          {candidate.className && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {candidate.className}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      {candidate.isAlreadyEnrolled ? (
                        <Badge variant="secondary" className="text-xs">
                          {t('extracurricular.enrolled')}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            handleEnroll(candidate.id, candidate.userType)
                          }
                          disabled={isEnrolling}
                        >
                          {isEnrolling ? (
                            <Spinner className="mr-1.5 h-3.5 w-3.5" />
                          ) : (
                            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {t('extracurricular.enroll')}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
