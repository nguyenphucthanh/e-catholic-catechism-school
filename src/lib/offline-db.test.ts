import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheStudents,
  enqueueScan,
  getCachedStudentsList,
  getPendingQueue,
  getSessionRecordsFromQueue,
  getStudentFromCache,
  removeRecordFromQueue,
  updateQueueStatus,
} from './offline-db'

const mockStore: Record<string, Array<any>> = {
  attendance_queue: [],
  student_cache: [],
}

const mockDb = {
  clear: vi.fn((storeName: string) => {
    mockStore[storeName] = []
  }),
  get: vi.fn((storeName: string, key: string) => {
    if (storeName === 'student_cache') {
      return mockStore.student_cache.find((s) => s.studentCode === key)
    }
    return mockStore.attendance_queue.find((a) => a.localId === key)
  }),
  getAll: vi.fn((storeName: string) => {
    return mockStore[storeName]
  }),
  put: vi.fn((storeName: string, val: any) => {
    const list = mockStore[storeName]
    const key = storeName === 'student_cache' ? 'studentCode' : 'localId'
    const idx = list.findIndex((x) => x[key] === val[key])
    if (idx >= 0) {
      list[idx] = val
    } else {
      list.push(val)
    }
  }),
  delete: vi.fn((storeName: string, key: string) => {
    const list = mockStore[storeName]
    const keyField = storeName === 'student_cache' ? 'studentCode' : 'localId'
    mockStore[storeName] = list.filter((x) => x[keyField] !== key)
  }),
  getAllFromIndex: vi.fn(
    (_storeName: string, indexName: string, value: any) => {
      if (indexName === 'by_syncStatus') {
        return mockStore.attendance_queue.filter((x) => x.syncStatus === value)
      }
      if (indexName === 'by_sessionId') {
        return mockStore.attendance_queue.filter((x) => x.sessionId === value)
      }
      return []
    },
  ),
  transaction: vi.fn((storeName: string) => {
    const store = {
      clear: vi.fn(() => {
        mockStore[storeName] = []
      }),
      put: vi.fn((val: any) => {
        const list = mockStore[storeName]
        const key = storeName === 'student_cache' ? 'studentCode' : 'localId'
        const idx = list.findIndex((x) => x[key] === val[key])
        if (idx >= 0) {
          list[idx] = val
        } else {
          list.push(val)
        }
      }),
      get: vi.fn((key: any) => {
        if (storeName === 'student_cache') {
          return mockStore.student_cache.find((s) => s.studentCode === key)
        }
        return mockStore.attendance_queue.find((a) => a.localId === key)
      }),
      index: vi.fn(() => {
        return {
          get: vi.fn((keys: Array<any>) => {
            const [sessId, studClassId] = keys
            return mockStore.attendance_queue.find(
              (x) => x.sessionId === sessId && x.studentClassId === studClassId,
            )
          }),
        }
      }),
    }
    return {
      objectStore: vi.fn(() => store),
      done: Promise.resolve(),
    }
  }),
}

vi.mock('idb', () => ({
  openDB: vi.fn(() => mockDb),
}))

describe('offline IndexedDB storage helpers', () => {
  beforeEach(() => {
    mockStore.attendance_queue = []
    mockStore.student_cache = []
    vi.clearAllMocks()
  })

  it('caches student list and fetches a single cached student', async () => {
    const testStudents = [
      {
        studentId: 'stud1',
        studentClassId: 'sc1',
        studentCode: 'HS001',
        fullName: 'Nguyen Van A',
        saintName: 'Giuse',
        className: 'Lop 1',
      },
      {
        studentId: 'stud2',
        studentClassId: 'sc2',
        studentCode: 'HS002',
        fullName: 'Tran Thi B',
        saintName: 'Maria',
        className: 'Lop 2',
      },
    ]

    await cacheStudents(testStudents)

    expect(mockStore.student_cache).toHaveLength(2)
    expect(mockStore.student_cache[0].studentCode).toBe('HS001')

    const result = await getStudentFromCache('HS001')
    expect(result).toBeDefined()
    expect(result?.fullName).toBe('Nguyen Van A')

    const all = await getCachedStudentsList()
    expect(all).toHaveLength(2)
  })

  it('enqueues a scan and retrieves it correctly', async () => {
    const scan = {
      sessionId: 'sess123',
      studentClassId: 'sc123',
      studentCode: 'HS001',
      status: 'present' as const,
      recordedBy: 'cat123',
    }

    const record = await enqueueScan(scan)
    expect(record.localId).toBeDefined()
    expect(record.syncStatus).toBe('pending')
    expect(mockStore.attendance_queue).toHaveLength(1)

    // Try enqueuing duplicate, should not add new record
    const dupRecord = await enqueueScan(scan)
    expect(dupRecord.localId).toBe(record.localId)
    expect(mockStore.attendance_queue).toHaveLength(1)
  })

  it('filters queue by syncStatus and sessionId', async () => {
    mockStore.attendance_queue = [
      {
        localId: '1',
        sessionId: 'sessA',
        studentClassId: 'sc1',
        studentCode: 'HS001',
        status: 'present',
        syncStatus: 'pending',
      },
      {
        localId: '2',
        sessionId: 'sessA',
        studentClassId: 'sc2',
        studentCode: 'HS002',
        status: 'present',
        syncStatus: 'synced',
      },
      {
        localId: '3',
        sessionId: 'sessB',
        studentClassId: 'sc3',
        studentCode: 'HS003',
        status: 'present',
        syncStatus: 'pending',
      },
    ]

    const pending = await getPendingQueue()
    expect(pending).toHaveLength(2)
    expect(pending.map((x) => x.localId)).toEqual(['1', '3'])

    const sessionARecords = await getSessionRecordsFromQueue('sessA')
    expect(sessionARecords).toHaveLength(2)
    expect(sessionARecords.map((x) => x.localId)).toEqual(['1', '2'])
  })

  it('updates sync status and removes records', async () => {
    mockStore.attendance_queue = [
      {
        localId: '1',
        sessionId: 'sessA',
        studentClassId: 'sc1',
        studentCode: 'HS001',
        status: 'present',
        syncStatus: 'pending',
      },
    ]

    await updateQueueStatus('1', 'error', 'Network error')
    expect(mockStore.attendance_queue[0].syncStatus).toBe('error')
    expect(mockStore.attendance_queue[0].errorMessage).toBe('Network error')

    await removeRecordFromQueue('1')
    expect(mockStore.attendance_queue).toHaveLength(0)
  })

  it('clears database stores via clearDb', async () => {
    const { clearDb } = await import('./offline-db')
    mockStore.attendance_queue = [{ localId: '1' }]
    mockStore.student_cache = [{ studentCode: 'HS001' }]

    await clearDb()
    expect(mockStore.attendance_queue).toHaveLength(0)
    expect(mockStore.student_cache).toHaveLength(0)
  })

  it('executes upgrade callback when opening DB', async () => {
    const { openDB } = await import('idb')
    const openDbMock = vi.mocked(openDB)
    const upgradeCallback = openDbMock.mock.calls.find((call) => call[2]?.upgrade)?.[2]?.upgrade
    if (upgradeCallback) {
      const mockCreateStore = vi.fn().mockReturnValue({ createIndex: vi.fn() })
      const mockDbInstance = {
        objectStoreNames: { contains: () => false },
        createObjectStore: mockCreateStore,
      }
      upgradeCallback(mockDbInstance as any, 0, 1, {} as any, {} as any)
      expect(mockCreateStore).toHaveBeenCalledWith('attendance_queue', {
        keyPath: 'localId',
      })
      expect(mockCreateStore).toHaveBeenCalledWith('student_cache', {
        keyPath: 'studentCode',
      })
    }
  })
})
