import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex, useMutation } from 'convex/react'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  Search,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { api } from '../../../../convex/_generated/api'
import type { LocalStudent } from '~/lib/offline-db'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import {
  cacheStudents,
  enqueueScan,
  getSessionRecordsFromQueue,
  initDb,
} from '~/lib/offline-db'
import { useAttendanceSync } from '~/hooks/use-attendance-sync'
import { QRScanner } from '~/components/custom/qr-scanner'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Badge } from '~/components/ui/badge'
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '~/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group'
import { formatPersonName } from '~/lib/name'

// Web Audio API Beep Generator
function playBeep(type: 'success' | 'duplicate' | 'error') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      window.AudioContext || (window as any).webkitAudioContext
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    if (type === 'success') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1000, ctx.currentTime)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } else if (type === 'duplicate') {
      const playSingle = (delay: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, ctx.currentTime + delay)
        gain.gain.setValueAtTime(0.06, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + delay + 0.08,
        )
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.08)
      }
      playSingle(0)
      playSingle(0.12)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (type === 'error') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(120, ctx.currentTime)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    }
  } catch (err) {
    console.warn('AudioContext beep failed:', err)
  }
}

export const Route = createFileRoute('/_authenticated/_catechist/attendance')({
  component: AttendancePWA,
})

function AttendancePWA() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { selectedYearId } = useSelectedAcademicYear()
  const convex = useConvex()

  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined

  // 1. App States
  const [step, setStep] = useState<'select' | 'scanning' | 'review'>('select')
  const [selectedType, setSelectedType] = useState<'mass' | 'extracurricular'>(
    'mass',
  )
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0],
  )

  const [sessionId, setSessionId] = useState<Id<'classSessions'> | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string>('')
  const [students, setStudents] = useState<Array<LocalStudent>>([])
  const [scannedCodes, setScannedCodes] = useState<Set<string>>(new Set())
  const [cameraActive, setCameraActive] = useState<boolean>(false)

  // Scans history for UI lists
  const [scanHistory, setScanHistory] = useState<
    Array<{
      code: string
      name: string
      className: string
      status: 'success' | 'duplicate' | 'unknown'
      timestamp: number
    }>
  >([])

  const [lastScanOverlay, setLastScanOverlay] = useState<{
    status: 'success' | 'duplicate' | 'unknown'
    name: string
    code: string
  } | null>(null)

  // Manual fallback search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 2. Background Sync Hook
  const { isOnline, syncStatus, pendingCount, syncNow } =
    useAttendanceSync(requesterId)

  // 3. Convex queries & mutations
  const openOrGetParishSessionMutation = useMutation(
    api.classSessions.openOrGetParishSession,
  )

  // student_cache lookup map for immediate O(1) scanner responses
  const studentCacheMap = useMemo(() => {
    const map = new Map<string, LocalStudent>()
    for (const student of students) {
      map.set(student.studentCode, student)
    }
    return map
  }, [students])

  // QR Scan debounce (per student code)
  const lastScannedTimestamps = useRef<Record<string, number>>({})

  // Initialize DB on page load
  useEffect(() => {
    initDb().catch((err) => console.error('Failed to init IndexedDB:', err))
  }, [])

  // Sync state with IndexedDB queue periodically or when sessionId matches
  useEffect(() => {
    if (!sessionId) return

    async function loadScannedRecords() {
      const records = await getSessionRecordsFromQueue(sessionId!)
      const presentCodes = new Set<string>()
      for (const rec of records) {
        if (rec.status === 'present' || rec.status === 'late') {
          presentCodes.add(rec.studentCode)
        }
      }
      setScannedCodes(presentCodes)
    }
    loadScannedRecords()
  }, [sessionId, pendingCount])

  // Handle overlay dismissal timer
  useEffect(() => {
    if (!lastScanOverlay) return
    const timer = setTimeout(() => {
      setLastScanOverlay(null)
    }, 1000)
    return () => clearTimeout(timer)
  }, [lastScanOverlay])

  // Filter students for search dialog
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const query = searchQuery.toLowerCase()
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        (s.saintName && s.saintName.toLowerCase().includes(query)) ||
        s.studentCode.toLowerCase().includes(query),
    )
  }, [searchQuery, students])

  // 6. Action Handlers
  const handleStartScanning = async () => {
    if (!requesterId || !selectedYearId) return

    try {
      const session = await openOrGetParishSessionMutation({
        requesterId,
        sessionDate: selectedDate,
        sessionType: selectedType,
      })
      const activeSessionId = session._id
      const title =
        selectedType === 'mass'
          ? t('attendance.session.massTitle', { date: selectedDate })
          : t('attendance.session.eventTitle', { date: selectedDate })

      setSessionId(activeSessionId)
      setSessionTitle(title)

      // Pre-fetch students & records
      toast.loading(t('attendance.select.loadingStudents'))
      const sessionData = await convex.query(
        api.attendanceQueries.getSessionStudents,
        {
          sessionId: activeSessionId,
          requesterId,
        },
      )
      toast.dismiss()

      // Cache students locally in IndexedDB
      const localStudents: Array<LocalStudent> = sessionData.students.map(
        (s: any) => ({
          studentId: s.studentId,
          studentClassId: s.studentClassId,
          studentCode: s.studentCode,
          fullName: s.fullName,
          saintName: s.saintName,
          className: s.className,
          cachedAt: Date.now(),
        }),
      )

      await cacheStudents(localStudents)
      setStudents(localStudents)

      // Load already synced records to Set
      const presentCodes = new Set<string>()
      for (const rec of sessionData.records) {
        if (rec.status === 'present' || rec.status === 'late') {
          // Find student code matching studentClassId
          const match = localStudents.find(
            (ls: any) => ls.studentClassId === rec.studentClassId,
          )
          if (match) presentCodes.add(match.studentCode)
        }
      }
      setScannedCodes(presentCodes)

      // Transition to scanning step
      setStep('scanning')
      setCameraActive(true)
      setScanHistory([])
      setLastScanOverlay(null)
    } catch (err: any) {
      toast.dismiss()
      toast.error(
        t('attendance.select.startError', {
          message: err.message || t('attendance.select.unknownError'),
        }),
      )
    }
  }

  // Scanned QR code event handler
  const handleQRScan = async (code: string) => {
    if (!sessionId || !requesterId) return

    // 1. Debounce check
    const now = Date.now()
    const lastScanned = lastScannedTimestamps.current[code] || 0
    if (now - lastScanned < 1500) {
      return // Skip repeated fire
    }
    lastScannedTimestamps.current[code] = now

    // 2. Lookup Cache
    const student = studentCacheMap.get(code)
    if (!student) {
      playBeep('error')
      setLastScanOverlay({
        status: 'unknown',
        code,
        name: t('attendance.scanning.invalidCode'),
      })
      setScanHistory((prev) => [
        {
          code,
          name: t('attendance.scanning.unknownStudent'),
          className: '—',
          status: 'unknown',
          timestamp: now,
        },
        ...prev,
      ])
      return
    }

    // 3. Duplicate check
    if (scannedCodes.has(code)) {
      playBeep('duplicate')
      setLastScanOverlay({
        status: 'duplicate',
        code,
        name: student.fullName,
      })
      return
    }

    // 4. Save present scan
    playBeep('success')
    setLastScanOverlay({
      status: 'success',
      code,
      name: student.fullName,
    })
    setScannedCodes((prev) => {
      const next = new Set(prev)
      next.add(code)
      return next
    })
    setScanHistory((prev) => [
      {
        code,
        name: student.fullName,
        className: student.className,
        status: 'success',
        timestamp: now,
      },
      ...prev,
    ])

    await enqueueScan({
      sessionId,
      studentClassId: student.studentClassId,
      studentCode: code,
      status: 'present',
      recordedBy: requesterId,
    })

    // Fire sync mutation immediately in background
    syncNow()
  }

  // Mark a single student manually present
  const handleManualMarkPresent = async (student: LocalStudent) => {
    setSearchOpen(false)
    await handleQRScan(student.studentCode)
  }

  // Set individual student absences in Review phase
  const handleSetAbsenceStatus = async (
    student: LocalStudent,
    status: 'excused_absence' | 'unexcused_absence' | 'present',
  ) => {
    if (!sessionId || !requesterId) return

    if (status === 'present') {
      setScannedCodes((prev) => {
        const next = new Set(prev)
        next.add(student.studentCode)
        return next
      })
    } else {
      setScannedCodes((prev) => {
        const next = new Set(prev)
        next.delete(student.studentCode)
        return next
      })
    }

    await enqueueScan({
      sessionId,
      studentClassId: student.studentClassId,
      studentCode: student.studentCode,
      status,
      recordedBy: requesterId,
    })

    syncNow()
  }

  const handleFinishSession = () => {
    setCameraActive(false)
    setStep('review')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none">
      {/* ─── HEADER BAR ─── */}
      <header className="px-4 py-3 bg-card border-b border-border flex items-center justify-between shadow-md rounded-lg">
        <div className="flex items-center gap-3">
          {step !== 'select' && (
            <button
              onClick={() => {
                if (step === 'review') {
                  setStep('scanning')
                  setCameraActive(true)
                } else {
                  setStep('select')
                  setCameraActive(false)
                }
              }}
              className="p-2 hover:bg-accent text-muted-foreground hover:text-foreground rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-bold text-base md:text-lg flex items-center gap-2">
              {t('attendance.title')}
            </h1>
            {step !== 'select' && (
              <p className="text-xs text-muted-foreground font-medium truncate max-w-[200px] md:max-w-xs">
                {sessionTitle}
              </p>
            )}
          </div>
        </div>

        {/* Network & Sync Badge */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span title={t('attendance.online')}>
              <Wifi className="w-4 h-4 text-green-500" />
            </span>
          ) : (
            <span title={t('attendance.offline')}>
              <WifiOff className="w-4 h-4 text-amber-500" />
            </span>
          )}

          {/* Sync Dot Status */}
          {syncStatus === 'syncing' ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : syncStatus === 'pending' || pendingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {t('attendance.syncPending', { count: pendingCount })}
            </div>
          ) : syncStatus === 'error' ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive/20 border border-destructive/30 text-destructive text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              {t('attendance.syncError')}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-600 dark:text-green-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {t('attendance.synced')}
            </div>
          )}
        </div>
      </header>

      {/* ─── 1. SESSION SELECTION STEP ─── */}
      {step === 'select' && (
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-extrabold">
                {t('attendance.select.title')}
              </CardTitle>
              <CardDescription>
                {t('attendance.select.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {/* Session Type */}
                <Field>
                  <FieldLabel>{t('attendance.select.type.label')}</FieldLabel>
                  <FieldContent>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'mass', label: t('attendance.select.type.mass') },
                        {
                          id: 'extracurricular',
                          label: t('attendance.select.type.extracurricular'),
                        },
                      ].map((typeOption) => (
                        <Button
                          key={typeOption.id}
                          onClick={() => {
                            setSelectedType(typeOption.id as any)
                          }}
                          variant={
                            selectedType === typeOption.id
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {typeOption.label}
                        </Button>
                      ))}
                    </div>
                  </FieldContent>
                </Field>

                {/* Date Selection */}
                <Field>
                  <FieldLabel>{t('attendance.select.date.label')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Calendar />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="pl-10"
                    />
                  </InputGroup>
                </Field>

                {/* Submit Button */}
                <Button
                  onClick={handleStartScanning}
                  size={'lg'}
                  className="w-full rounded-full shadow-lg shadow-primary/20"
                >
                  {t('attendance.select.submit')}
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>
        </main>
      )}

      {/* ─── 2. SCANNING MODE STEP ─── */}
      {step === 'scanning' && (
        <main className="flex-1 flex flex-col md:flex-row relative rounded-lg mt-4 overflow-hidden shadow-lg">
          {/* Main camera viewport */}
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <QRScanner onScan={handleQRScan} active={cameraActive} />

            {/* Float HUD Header Over Scanner */}
            <div className="absolute top-4 left-4 right-4 pointer-events-none flex justify-between items-start">
              <div className="bg-black/75 px-3 py-1.5 rounded-lg border border-border text-white flex items-center gap-2 shadow-lg">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold">
                  {t('attendance.scanning.presentCount', {
                    present: scannedCodes.size,
                    total: students.length,
                  })}
                </span>
              </div>
            </div>

            {/* Floating Action Buttons */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center gap-4">
              <Button
                onClick={() => setSearchOpen(true)}
                className="bg-card/90 hover:bg-accent border border-border text-foreground rounded-lg px-4 py-3 flex items-center gap-2 shadow-xl backdrop-blur-sm active:scale-95"
              >
                <Search className="w-4 h-4" />{' '}
                {t('attendance.scanning.manualEntry')}
              </Button>

              <Button
                onClick={handleFinishSession}
                className="rounded-lg px-5 py-3 font-bold shadow-xl active:scale-95"
              >
                {t('attendance.scanning.finish')}
              </Button>
            </div>

            {/* ─── SCAN RESULTS FULL-SCREEN FLASH OVERLAYS ─── */}
            {lastScanOverlay && (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-300 ${
                  lastScanOverlay.status === 'success'
                    ? 'bg-green-500/90 animate-[fade-out_2.5s_forwards]'
                    : lastScanOverlay.status === 'duplicate'
                      ? 'bg-amber-500/95 animate-[fade-out_2.5s_forwards]'
                      : 'bg-destructive/95 animate-[fade-out_2.5s_forwards]'
                }`}
              >
                {lastScanOverlay.status === 'success' && (
                  <>
                    <CheckCircle2 className="w-20 h-20 text-white mb-2 animate-bounce" />
                    <span className="text-2xl font-black text-white px-6 text-center drop-shadow-md">
                      {lastScanOverlay.name}
                    </span>
                    <span className="text-sm font-bold text-white bg-black/30 px-3 py-1 rounded-full mt-2">
                      {t('attendance.scanning.overlay.success')}
                    </span>
                  </>
                )}
                {lastScanOverlay.status === 'duplicate' && (
                  <>
                    <AlertCircle className="w-20 h-20 text-white mb-2 animate-pulse" />
                    <span className="text-2xl font-black text-white px-6 text-center drop-shadow-md">
                      {lastScanOverlay.name}
                    </span>
                    <span className="text-sm font-bold text-white bg-black/30 px-3 py-1 rounded-full mt-2">
                      {t('attendance.scanning.overlay.duplicate')}
                    </span>
                  </>
                )}
                {lastScanOverlay.status === 'unknown' && (
                  <>
                    <X className="w-20 h-20 text-white mb-2 animate-ping" />
                    <span className="text-2xl font-black text-white px-6 text-center drop-shadow-md">
                      {t('attendance.scanning.overlay.unknown', {
                        code: lastScanOverlay.code,
                      })}
                    </span>
                    <span className="text-sm font-bold text-white bg-black/30 px-3 py-1 rounded-full mt-2">
                      {t('attendance.scanning.overlay.unknownLabel')}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Scanned side logs (Desktop side-view, Mobile collapsed) */}
          <div className="h-44 md:h-auto md:w-80 bg-card border-t md:border-t-0 md:border-l border-border flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-background flex justify-between items-center">
              <span className="text-xs font-bold text-muted-foreground">
                {t('attendance.scanning.history.title')}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">
                {t('attendance.scanning.history.count', {
                  count: scanHistory.length,
                })}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {scanHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
                  {t('attendance.scanning.history.empty')}
                </div>
              ) : (
                scanHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-start gap-2.5 hover:bg-accent/40"
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.status === 'success'
                          ? 'bg-green-500'
                          : item.status === 'duplicate'
                            ? 'bg-amber-500'
                            : 'bg-destructive'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {item.name}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {t('attendance.scanning.history.classLabel', {
                            className: item.className,
                          })}
                        </span>
                        <span>
                          {t('attendance.scanning.history.codeLabel', {
                            code: item.code,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* ─── 3. REVIEW AND CONFIRMATION STEP ─── */}
      {step === 'review' && (
        <main className="flex-1 flex flex-col p-4 max-w-4xl mx-auto w-full">
          <Tabs defaultValue="unrecorded" className="flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border flex-wrap gap-2">
              <TabsList>
                <TabsTrigger value="all" className="text-xs px-3">
                  {t('attendance.review.tabAll', { count: students.length })}
                </TabsTrigger>
                <TabsTrigger value="recorded" className="text-xs px-3">
                  {t('attendance.review.tabPresent', {
                    count: scannedCodes.size,
                  })}
                </TabsTrigger>
                <TabsTrigger value="unrecorded" className="text-xs px-3">
                  {t('attendance.review.tabAbsent', {
                    count: students.length - scannedCodes.size,
                  })}
                </TabsTrigger>
              </TabsList>

              <Button
                onClick={() => {
                  toast.success(t('attendance.review.finishSuccess'))
                  navigate({ to: '/dashboard' })
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg active:scale-95"
              >
                {t('attendance.review.finish')}
              </Button>
            </div>

            {/* List All */}
            <TabsContent
              value="all"
              className="flex-1 overflow-y-auto mt-3 outline-none"
            >
              <div className="grid gap-2">
                {students.map((student) => {
                  const isPresent = scannedCodes.has(student.studentCode)
                  return (
                    <div
                      key={student.studentCode}
                      className="p-3 bg-card/60 border border-border rounded-lg flex items-center justify-between hover:bg-card"
                    >
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {formatPersonName(
                            student.saintName,
                            student.fullName,
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('attendance.review.codeClassLabel', {
                            code: student.studentCode,
                            className: student.className,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPresent ? (
                          <Badge className="bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-400 font-semibold">
                            {t('attendance.review.present')}
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/20 border-destructive/30 text-destructive font-semibold">
                            {t('attendance.review.absent')}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetAbsenceStatus(
                              student,
                              isPresent ? 'unexcused_absence' : 'present',
                            )
                          }
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t('attendance.review.changeStatus')}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            {/* List Present */}
            <TabsContent
              value="recorded"
              className="flex-1 overflow-y-auto mt-3 outline-none"
            >
              <div className="grid gap-2">
                {students
                  .filter((s) => scannedCodes.has(s.studentCode))
                  .map((student) => (
                    <div
                      key={student.studentCode}
                      className="p-3 bg-card/60 border border-border rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {student.fullName}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('attendance.review.classLabel', {
                            className: student.className,
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleSetAbsenceStatus(student, 'unexcused_absence')
                        }
                        className="text-destructive hover:text-destructive/80 text-xs flex items-center gap-1.5 hover:bg-destructive/10 px-2.5 py-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />{' '}
                        {t('attendance.review.remove')}
                      </Button>
                    </div>
                  ))}
                {scannedCodes.size === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {t('attendance.review.noPresent')}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* List Absent (Allows excused vs unexcused assignment) */}
            <TabsContent
              value="unrecorded"
              className="flex-1 overflow-y-auto mt-3 outline-none"
            >
              <div className="grid gap-2">
                {students
                  .filter((s) => !scannedCodes.has(s.studentCode))
                  .map((student) => (
                    <div
                      key={student.studentCode}
                      className="p-3 bg-card/60 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {student.fullName}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('attendance.review.classLabel', {
                            className: student.className,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetAbsenceStatus(student, 'present')
                          }
                          className="bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/20 text-xs"
                        >
                          {t('attendance.review.markPresent')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetAbsenceStatus(student, 'excused_absence')
                          }
                          className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs"
                        >
                          {t('attendance.review.excused')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetAbsenceStatus(student, 'unexcused_absence')
                          }
                          className="bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 text-xs"
                        >
                          {t('attendance.review.unexcused')}
                        </Button>
                      </div>
                    </div>
                  ))}
                {students.length - scannedCodes.size === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {t('attendance.review.allPresent')}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      )}

      {/* ─── 4. DIALOGS (MANUAL SEARCH FALLBACK) ─── */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-md w-[95%] rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('attendance.search.title')}</DialogTitle>
            <DialogDescription>
              {t('attendance.search.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('attendance.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="h-60 overflow-y-auto divide-y divide-border/80 border border-border rounded-lg">
              {filteredStudents.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  {t('attendance.search.noResults')}
                </p>
              ) : (
                filteredStudents.map((s) => {
                  const isPresent = scannedCodes.has(s.studentCode)
                  return (
                    <button
                      key={s.studentCode}
                      onClick={() => !isPresent && handleManualMarkPresent(s)}
                      disabled={isPresent}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-accent disabled:opacity-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-xs text-foreground">
                          {s.fullName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {t('attendance.review.codeClassLabel', {
                            code: s.studentCode,
                            className: s.className,
                          })}
                        </p>
                      </div>
                      {isPresent ? (
                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/30">
                          {t('attendance.search.alreadyPresent')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30">
                          {t('attendance.search.markPresent')}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
