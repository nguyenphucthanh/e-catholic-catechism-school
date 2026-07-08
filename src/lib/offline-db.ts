import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'

export interface LocalStudent {
  studentId: string
  studentClassId: string
  studentCode: string
  fullName: string
  saintName: string | null
  className: string
  cachedAt: number
}

export interface LocalAttendanceRecord {
  localId: string
  sessionId: string
  studentClassId: string
  studentCode: string
  status: 'present' | 'excused_absence' | 'unexcused_absence' | 'late'
  notes?: string
  recordedBy: string
  deviceQueuedAt: number
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error'
  errorMessage?: string
}

const DB_NAME = 'giaoly-attendance'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

export function initDb(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('IndexedDB is only available in the browser'),
    )
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Queue for offline records to be synced
        if (!db.objectStoreNames.contains('attendance_queue')) {
          const queueStore = db.createObjectStore('attendance_queue', {
            keyPath: 'localId',
          })
          queueStore.createIndex('by_sessionId', 'sessionId')
          queueStore.createIndex('by_syncStatus', 'syncStatus')
          queueStore.createIndex('by_sessionId_and_studentClassId', [
            'sessionId',
            'studentClassId',
          ])
        }
        // Cache of student profiles for quick lookup
        if (!db.objectStoreNames.contains('student_cache')) {
          db.createObjectStore('student_cache', { keyPath: 'studentCode' })
        }
      },
    })
  }
  return dbPromise
}

export async function clearDb(): Promise<void> {
  const db = await initDb()
  await db.clear('attendance_queue')
  await db.clear('student_cache')
}

export async function cacheStudents(
  students: Array<Omit<LocalStudent, 'cachedAt'>>,
): Promise<void> {
  const db = await initDb()
  const tx = db.transaction('student_cache', 'readwrite')
  const store = tx.objectStore('student_cache')

  // Clear old cache first
  await store.clear()

  const cachedAt = Date.now()
  for (const student of students) {
    await store.put({
      ...student,
      cachedAt,
    })
  }
  await tx.done
}

export async function getStudentFromCache(
  studentCode: string,
): Promise<LocalStudent | undefined> {
  const db = await initDb()
  return db.get('student_cache', studentCode)
}

export async function getCachedStudentsList(): Promise<Array<LocalStudent>> {
  const db = await initDb()
  return db.getAll('student_cache')
}

export async function enqueueScan(record: {
  sessionId: string
  studentClassId: string
  studentCode: string
  status: 'present' | 'excused_absence' | 'unexcused_absence' | 'late'
  notes?: string
  recordedBy: string
}): Promise<LocalAttendanceRecord> {
  const db = await initDb()

  // Check if a record already exists in the queue for this session & student
  const existingRecord = await db
    .transaction('attendance_queue', 'readonly')
    .objectStore('attendance_queue')
    .index('by_sessionId_and_studentClassId')
    .get([record.sessionId, record.studentClassId])

  if (existingRecord) {
    // If it's already present/synced, return it (avoid overwriting unless earlier, handled by server anyway)
    return existingRecord
  }

  const localId =
    typeof crypto !== 'undefined'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const newRecord: LocalAttendanceRecord = {
    localId,
    sessionId: record.sessionId,
    studentClassId: record.studentClassId,
    studentCode: record.studentCode,
    status: record.status,
    notes: record.notes,
    recordedBy: record.recordedBy,
    deviceQueuedAt: Date.now(),
    syncStatus: 'pending',
  }

  await db.put('attendance_queue', newRecord)
  return newRecord
}

export async function getPendingQueue(): Promise<Array<LocalAttendanceRecord>> {
  const db = await initDb()
  return db.getAllFromIndex('attendance_queue', 'by_syncStatus', 'pending')
}

export async function getSessionRecordsFromQueue(
  sessionId: string,
): Promise<Array<LocalAttendanceRecord>> {
  const db = await initDb()
  return db.getAllFromIndex('attendance_queue', 'by_sessionId', sessionId)
}

export async function updateQueueStatus(
  localId: string,
  syncStatus: 'synced' | 'conflict' | 'error',
  errorMessage?: string,
): Promise<void> {
  const db = await initDb()
  const tx = db.transaction('attendance_queue', 'readwrite')
  const store = tx.objectStore('attendance_queue')
  const record = await store.get(localId)
  if (record) {
    record.syncStatus = syncStatus
    if (errorMessage) record.errorMessage = errorMessage
    await store.put(record)
  }
  await tx.done
}

export async function removeRecordFromQueue(localId: string): Promise<void> {
  const db = await initDb()
  await db.delete('attendance_queue', localId)
}
