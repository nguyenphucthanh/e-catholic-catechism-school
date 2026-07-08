import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex, useMutation, useQuery } from 'convex/react'
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
import { NativeSelect } from '~/components/ui/native-select'

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
  const [selectedType, setSelectedType] = useState<
    'mass' | 'extracurricular' | 'catechism' | 'supplemental'
  >('mass')
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0],
  )
  const [selectedClassId, setSelectedClassId] = useState<string>('')

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
  const classesList = useQuery(
    api.classes.listClassYears,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const openOrGetParishSessionMutation = useMutation(
    api.attendance.openOrGetParishSession,
  )
  const createSessionMutation = useMutation(api.classSessions.create)

  const sessionsList = useQuery(
    api.classSessions.list,
    requesterId && selectedClassId
      ? {
          requesterId,
          classYearId: selectedClassId as Id<'classYears'>,
          sessionType:
            selectedType === 'catechism' || selectedType === 'supplemental'
              ? selectedType
              : undefined,
          dateFrom: selectedDate,
          dateTo: selectedDate,
        }
      : 'skip',
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
      let activeSessionId: Id<'classSessions'>
      let title = ''

      if (selectedType === 'mass' || selectedType === 'extracurricular') {
        const session = await openOrGetParishSessionMutation({
          requesterId,
          sessionDate: selectedDate,
          sessionType: selectedType,
        })
        activeSessionId = session._id
        title =
          selectedType === 'mass'
            ? `Lễ ngày ${selectedDate}`
            : `Sự kiện ngày ${selectedDate}`
      } else {
        // Catechism or supplemental (Class scoped)
        if (!selectedClassId) {
          toast.error('Vui lòng chọn lớp học')
          return
        }

        const classRecord = classesList?.find(
          (c: any) => c.classYearId === selectedClassId,
        )
        const className = classRecord?.className ?? 'Lớp học'

        // Check if session already exists
        const existingSession = sessionsList?.find(
          (s: any) => !s.isDeleted && s.sessionDate === selectedDate,
        )

        if (existingSession) {
          activeSessionId = existingSession._id
        } else {
          // If semester is required, fetch semester list and pick active one
          const semesters = await fetchSemestersForYear(selectedYearId)
          const activeSemester = semesters.find((s: any) => !s.isDeleted) // Default first semester or active

          if (!activeSemester) {
            toast.error('Không tìm thấy học kỳ cho năm học hiện tại')
            return
          }

          // Create new session
          activeSessionId = await createSessionMutation({
            requesterId,
            classYearId: selectedClassId as Id<'classYears'>,
            semesterId: activeSemester._id,
            sessionDate: selectedDate,
            sessionType: selectedType,
          })
        }
        title = `${className} - Ngày ${selectedDate}`
      }

      setSessionId(activeSessionId)
      setSessionTitle(title)

      // Pre-fetch students & records
      toast.loading('Đang tải danh sách học sinh...')
      const sessionData = await convex.query(
        api.attendance.getSessionStudents,
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
      toast.error(`Không thể bắt đầu: ${err.message || 'Lỗi không xác định'}`)
    }
  }

  // Helper to fetch semesters
  const fetchSemestersForYear = async (yearId: Id<'academicYears'>) => {
    if (!requesterId) return []
    return await convex.query(api.academicYears.listSemesters, {
      requesterId,
      academicYearId: yearId,
    })
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
        name: 'Mã không hợp lệ',
      })
      setScanHistory((prev) => [
        {
          code,
          name: 'Học sinh lạ',
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

  // Mark all present shortcut
  const handleMarkAllPresent = async () => {
    if (!sessionId || !requesterId || students.length === 0) return

    const unrecorded = students.filter((s) => !scannedCodes.has(s.studentCode))
    if (unrecorded.length === 0) {
      toast.info('Tất cả học sinh đã có mặt')
      return
    }

    toast.loading('Đang ghi nhận mặt tất cả...')

    for (const student of unrecorded) {
      setScannedCodes((prev) => {
        const next = new Set(prev)
        next.add(student.studentCode)
        return next
      })

      await enqueueScan({
        sessionId,
        studentClassId: student.studentClassId,
        studentCode: student.studentCode,
        status: 'present',
        recordedBy: requesterId,
      })
    }

    playBeep('success')
    toast.dismiss()
    toast.success(`Đã ghi danh mặt ${unrecorded.length} học sinh`)
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* ─── HEADER BAR ─── */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-md">
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
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-bold text-base md:text-lg flex items-center gap-2">
              Điểm Danh Giáo Lý
            </h1>
            {step !== 'select' && (
              <p className="text-xs text-neutral-400 font-medium truncate max-w-[200px] md:max-w-xs">
                {sessionTitle}
              </p>
            )}
          </div>
        </div>

        {/* Network & Sync Badge */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span title="Online">
              <Wifi className="w-4 h-4 text-emerald-400" />
            </span>
          ) : (
            <span title="Offline">
              <WifiOff className="w-4 h-4 text-amber-500" />
            </span>
          )}

          {/* Sync Dot Status */}
          {syncStatus === 'syncing' ? (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          ) : syncStatus === 'pending' || pendingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {pendingCount} chờ đồng bộ
            </div>
          ) : syncStatus === 'error' ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Lỗi đồng bộ
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Đã đồng bộ
            </div>
          )}

          {/* Exit shortcut */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard' })}
            className="text-slate-400 hover:text-white px-2 py-1 text-xs"
          >
            Dashboard
          </Button>
        </div>
      </header>

      {/* ─── 1. SESSION SELECTION STEP ─── */}
      {step === 'select' && (
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-200 shadow-2xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-extrabold text-white">
                Bắt đầu Điểm danh
              </CardTitle>
              <CardDescription className="text-slate-400">
                Thiết lập thông tin buổi quét. Hệ thống sẽ tự động tìm kiếm hoặc
                khởi tạo phiên điểm danh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {/* Session Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Loại phiên điểm danh
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'mass', label: 'Đi Lễ' },
                    { id: 'catechism', label: 'Học Giáo Lý' },
                    { id: 'supplemental', label: 'Buổi Phụ Trợ' },
                    { id: 'extracurricular', label: 'Ngoại Khóa' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedType(t.id as any)
                        setSelectedClassId('')
                      }}
                      className={`py-3 px-3 rounded-lg border text-sm font-semibold transition-all duration-200 ${
                        selectedType === t.id
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Ngày điểm danh
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white rounded-lg focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Class Selection (Only for catechism/supplemental) */}
              {(selectedType === 'catechism' ||
                selectedType === 'supplemental') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Chọn lớp học
                  </label>
                  <NativeSelect
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white rounded-lg focus:ring-blue-600"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      -- Chọn lớp --
                    </option>
                    {classesList?.map((c) => (
                      <option
                        key={c.classYearId}
                        value={c.classYearId}
                        className="bg-slate-900 text-white"
                      >
                        {c.className}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleStartScanning}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-lg font-bold text-base shadow-lg shadow-blue-600/20 transition-all duration-200 active:scale-[0.98]"
              >
                Bắt đầu quét QR
              </Button>
            </CardContent>
          </Card>
        </main>
      )}

      {/* ─── 2. SCANNING MODE STEP ─── */}
      {step === 'scanning' && (
        <main className="flex-1 flex flex-col md:flex-row relative">
          {/* Main camera viewport */}
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <QRScanner onScan={handleQRScan} active={cameraActive} />

            {/* Float HUD Header Over Scanner */}
            <div className="absolute top-4 left-4 right-4 pointer-events-none flex justify-between items-start">
              <div className="bg-black/75 px-3 py-1.5 rounded-lg border border-slate-800 text-white flex items-center gap-2 shadow-lg">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold">
                  {scannedCodes.size} / {students.length} đã mặt
                </span>
              </div>
            </div>

            {/* Floating Action Buttons */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center gap-4">
              <Button
                onClick={() => setSearchOpen(true)}
                className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 flex items-center gap-2 shadow-xl backdrop-blur-sm active:scale-95"
              >
                <Search className="w-4 h-4" /> Nhập tay
              </Button>

              {(selectedType === 'catechism' ||
                selectedType === 'supplemental') && (
                <Button
                  onClick={handleMarkAllPresent}
                  className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm active:scale-95"
                >
                  Mọi người có mặt
                </Button>
              )}

              <Button
                onClick={handleFinishSession}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-3 font-bold shadow-xl active:scale-95"
              >
                Xem & Kết thúc
              </Button>
            </div>

            {/* ─── SCAN RESULTS FULL-SCREEN FLASH OVERLAYS ─── */}
            {lastScanOverlay && (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-300 ${
                  lastScanOverlay.status === 'success'
                    ? 'bg-emerald-500/90 animate-[fade-out_2.5s_forwards]'
                    : lastScanOverlay.status === 'duplicate'
                      ? 'bg-amber-500/95 animate-[fade-out_2.5s_forwards]'
                      : 'bg-red-500/95 animate-[fade-out_2.5s_forwards]'
                }`}
              >
                {lastScanOverlay.status === 'success' && (
                  <>
                    <CheckCircle2 className="w-20 h-20 text-white mb-2 animate-bounce" />
                    <span className="text-2xl font-black text-white px-6 text-center drop-shadow-md">
                      {lastScanOverlay.name}
                    </span>
                    <span className="text-sm font-bold text-emerald-100 bg-black/30 px-3 py-1 rounded-full mt-2">
                      HỢP LỆ — ĐÃ GHI NHẬN
                    </span>
                  </>
                )}
                {lastScanOverlay.status === 'duplicate' && (
                  <>
                    <AlertCircle className="w-20 h-20 text-white mb-2 animate-pulse" />
                    <span className="text-2xl font-black text-white px-6 text-center drop-shadow-md">
                      {lastScanOverlay.name}
                    </span>
                    <span className="text-sm font-bold text-amber-100 bg-black/30 px-3 py-1 rounded-full mt-2">
                      ĐÃ ĐIỂM DANH TRƯỚC ĐÓ
                    </span>
                  </>
                )}
                {lastScanOverlay.status === 'unknown' && (
                  <>
                    <X className="w-20 h-20 text-white mb-2 animate-ping" />
                    <span className="text-2xl font-black text-white px-6 text-center drop-shadow-md">
                      Mã: {lastScanOverlay.code}
                    </span>
                    <span className="text-sm font-bold text-red-100 bg-black/30 px-3 py-1 rounded-full mt-2">
                      MÃ LẠ — KHÔNG CÓ TRONG LỚP
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Scanned side logs (Desktop side-view, Mobile collapsed) */}
          <div className="h-44 md:h-auto md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col">
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400">
                Lịch sử quét vừa qua
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                {scanHistory.length} thẻ
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
              {scanHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 p-4 text-center">
                  Danh sách trống. Bắt đầu quét QR để ghi danh.
                </div>
              ) : (
                scanHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-start gap-2.5 hover:bg-slate-800/40"
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.status === 'success'
                          ? 'bg-emerald-400'
                          : item.status === 'duplicate'
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-white truncate">
                          {item.name}
                        </span>
                        <span className="text-[9px] text-neutral-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Lớp: {item.className}</span>
                        <span>Mã: {item.code}</span>
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
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger value="all" className="text-xs px-3">
                  Tất cả ({students.length})
                </TabsTrigger>
                <TabsTrigger value="recorded" className="text-xs px-3">
                  Có mặt ({scannedCodes.size})
                </TabsTrigger>
                <TabsTrigger value="unrecorded" className="text-xs px-3">
                  Vắng ({students.length - scannedCodes.size})
                </TabsTrigger>
              </TabsList>

              <Button
                onClick={() => {
                  toast.success('Báo cáo điểm danh đã hoàn tất')
                  navigate({ to: '/dashboard' })
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg active:scale-95"
              >
                Hoàn thành & Về trang chủ
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
                      className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between hover:bg-slate-900"
                    >
                      <div>
                        <div className="font-semibold text-sm text-white">
                          {student.saintName && (
                            <span className="text-slate-400 text-xs mr-1">
                              ({student.saintName})
                            </span>
                          )}
                          {student.fullName}
                        </div>
                        <p className="text-xs text-neutral-400">
                          Mã: {student.studentCode} | Lớp: {student.className}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPresent ? (
                          <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 font-semibold">
                            Có mặt
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 border-red-500/30 text-red-400 font-semibold">
                            Vắng mặt
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
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Đổi trạng thái
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
                      className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-sm text-white">
                          {student.fullName}
                        </div>
                        <p className="text-xs text-neutral-400">
                          Lớp: {student.className}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleSetAbsenceStatus(student, 'unexcused_absence')
                        }
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1.5 hover:bg-red-950/20 px-2.5 py-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                      </Button>
                    </div>
                  ))}
                {scannedCodes.size === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    Chưa có học sinh nào được ghi nhận có mặt.
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
                      className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-sm text-white">
                          {student.fullName}
                        </div>
                        <p className="text-xs text-neutral-400">
                          Lớp: {student.className}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetAbsenceStatus(student, 'present')
                          }
                          className="bg-emerald-950/20 border border-emerald-900 text-emerald-400 hover:bg-emerald-950/40 text-xs"
                        >
                          Có mặt
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetAbsenceStatus(student, 'excused_absence')
                          }
                          className="bg-indigo-950/20 border border-indigo-900 text-indigo-400 hover:bg-indigo-950/40 text-xs"
                        >
                          Vắng phép
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetAbsenceStatus(student, 'unexcused_absence')
                          }
                          className="bg-red-950/20 border border-red-900 text-red-400 hover:bg-red-950/40 text-xs"
                        >
                          Không phép
                        </Button>
                      </div>
                    </div>
                  ))}
                {students.length - scannedCodes.size === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    Tất cả học sinh đều đã được quét ghi danh có mặt!
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      )}

      {/* ─── 4. DIALOGS (MANUAL SEARCH FALLBACK) ─── */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-md w-[95%] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Tìm học sinh & Điểm danh
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Nhập mã học sinh, thánh danh hoặc tên để đánh dấu có mặt bằng tay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white rounded-lg focus:ring-blue-600"
              />
            </div>

            <div className="h-60 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded-lg">
              {filteredStudents.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500">
                  Không tìm thấy kết quả
                </p>
              ) : (
                filteredStudents.map((s) => {
                  const isPresent = scannedCodes.has(s.studentCode)
                  return (
                    <button
                      key={s.studentCode}
                      onClick={() => !isPresent && handleManualMarkPresent(s)}
                      disabled={isPresent}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/50 disabled:opacity-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-xs text-white">
                          {s.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Mã: {s.studentCode} | Lớp: {s.className}
                        </p>
                      </div>
                      {isPresent ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900">
                          Đã mặt
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900">
                          Chọn ghi danh
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
