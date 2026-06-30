[← Back to index](README.md)

## 11. Attendance System — QR & Offline-First

### 11.1 Overview & Core Constraints

Mass attendance must be **instantaneous** — no acceptable delay between scan and acknowledgement. Network latency cannot block the flow.

| Context   | Sessions                    | Students in scope          | Who scans           | Time pressure |
| --------- | --------------------------- | -------------------------- | ------------------- | ------------- |
| **Class** | `catechism`, `supplemental` | That class only (~25)      | Assigned catechists | Low           |
| **Mass**  | `mass`                      | All active students (~100) | Any catechist       | **High**      |

### 11.2 QR Card Design

- QR encodes only the raw `student_code` (e.g. `10042`). No prefix, no URL, no JSON.
- Physical card: student name + saint name + class + branch printed for visual verification.
- QR minimum size: 2.5 × 2.5 cm. Recommend lanyard hole.
- Lost card: reprint trivially — content never changes.

### 11.3 Technology Stack

| Layer         | Choice                                                   | Reason                                                                    |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| App delivery  | **PWA** (no native app)                                  | `getUserMedia` + `BarcodeDetector` works on Safari iOS and Chrome Android |
| QR scanning   | Native `BarcodeDetector` API + `@zxing/browser` fallback | BarcodeDetector fast on modern devices; ZXing covers older iOS            |
| Local queue   | **IndexedDB** via `idb` library                          | Persists across reloads and browser close                                 |
| Sync          | Convex mutations, batched                                | Handles retries natively                                                  |
| Offline shell | Service Worker + Web App Manifest                        | App loads with no network                                                 |

### 11.4 IndexedDB Stores

**`attendance_queue`**

| Field              | Notes                               |
| ------------------ | ----------------------------------- |
| `local_id`         | Client-generated UUID (primary key) |
| `session_id`       | Selected before scanning            |
| `student_code`     | Decoded from QR                     |
| `student_class_id` | Resolved from cache                 |
| `status`           | Default `present` for QR scans      |
| `recorded_by`      | Logged-in catechist id              |
| `device_queued_at` | `Date.now()` at scan moment         |
| `sync_status`      | `pending` / `synced` / `conflict`   |

**`student_cache`**

| Field              | Notes                                       |
| ------------------ | ------------------------------------------- |
| `student_code`     | Primary key                                 |
| `student_class_id` | For current session                         |
| `full_name`        | Display after scan                          |
| `saint_name`       | Display after scan                          |
| `class_name`       | Display after scan                          |
| `cached_at`        | For invalidation (refresh if > 2 hours old) |

### 11.5 Flows

**Pre-fetch (before scanning):**

```
1. Catechist selects ClassSession
2. App fetches from Convex:
   - Students in scope + student_code → student_class_id mapping
   - Already-recorded attendance for this session
3. Write all to IndexedDB
4. Signal: "Ready to scan offline"
```

**Scan loop (target < 200ms per student, zero network):**

```
1. Camera active, continuously scanning frames
2. QR decoded → student_code extracted client-side
3. Lookup in IndexedDB student_cache:
   ├─ Found + not yet recorded → write to queue → SUCCESS (green flash + beep + name)
   ├─ Found + already recorded → DUPLICATE (yellow flash + different beep)
   └─ Not found → UNKNOWN (red flash + error beep)
4. Camera auto-resets immediately — no tap needed
```

**Background sync (non-blocking, every 5 seconds while online):**

```
1. Read all sync_status = 'pending' from queue
2. Batch call Convex mutation: attendance:recordBatch(records)
3. On success → update sync_status = 'synced'
4. On conflict → update sync_status = 'conflict', log locally
5. On network error → leave as 'pending', retry next cycle
```

Also triggers immediately on `window.addEventListener('online', syncNow)`.

### 11.6 Conflict Resolution — First-Write-Wins

**Scenario:** Two catechists scan the same student while offline. Both sync. Duplicate inserts arrive for `(session_id, student_class_id)`.

**Rule:** Keep the record with the earlier `device_queued_at`. Discard the later one.

```
for each incoming record:
  existing = query by (session_id, student_class_id)
  if existing:
    if incoming.device_queued_at < existing.device_queued_at:
      replace existing  // earlier scan wins (rare edge case)
    else:
      discard incoming, return { status: 'conflict' }
  else:
    insert, return { status: 'synced' }
```

**Why this is correct:** the student was present — outcome is identical regardless of which device recorded first. Conflicts are benign and fully automatic.

### 11.7 Convex API

**Queries:**

- `attendance:getSessionStudents({ session_id })` — pre-fetch students + existing records
- `attendance:getSessionSummary({ session_id })` — count present / total, unrecorded list

**Mutations:**

- `attendance:recordBatch({ records })` — idempotent, first-write-wins, returns `{ local_id, status }[]`
- `attendance:updateRecord({ session_id, student_class_id, status, notes })` — manual correction
- `attendance:cancelSession({ session_id, reason })` — sets `is_cancelled = true`

**Permission enforcement in each mutation:**

```
mass / extracurricular → any active catechist
catechism / supplemental → assigned catechist OR branch_leader / board
```

### 11.8 Implementation Notes

**Camera setup:**

```javascript
// Primary: native BarcodeDetector
const detector = new BarcodeDetector({ formats: ['qr_code'] })

// Fallback: ZXing
import { BrowserQRCodeReader } from '@zxing/browser'

// Always request rear camera, 1280px width
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment', width: 1280 },
})
// Debounce 800ms to prevent double-fire on same QR
```

**IndexedDB setup:**

```javascript
import { openDB } from 'idb'
const db = await openDB('giaoly-attendance', 1, {
  upgrade(db) {
    db.createObjectStore('attendance_queue', { keyPath: 'local_id' })
    db.createObjectStore('student_cache', { keyPath: 'student_code' })
  },
})
```

**PWA manifest minimum:**

- `name`: "Điểm Danh Giáo Lý"
- `display`: `standalone`
- `start_url`: `/attendance`
- `icons`: 192×192 and 512×512 PNG

### 11.9 UX Requirements

- Full-screen camera, minimal UI chrome
- Overlay: session name + date + counter ("47 / 98 đã điểm danh")
- Sync dot: green (all synced) / yellow (pending queue)
- **No tap required between scans** — camera auto-resets
- Offline banner: "Đang lưu offline — sẽ đồng bộ khi có mạng" (non-blocking)
- **Class attendance shortcut:** "Mark all present" button, then catechist marks exceptions only
- Post-session review: unrecorded students list + quick-tap to mark absent
