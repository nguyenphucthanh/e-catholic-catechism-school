import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Fires at 00:00 UTC every 7 days — that's 07:00 Asia/Ho_Chi_Minh (UTC+7), NOT
// local midnight. The actual wipe+reseed only runs where the DEMO_APP env
// var is 'true'; internal.seed.resetDemoData's handler no-ops everywhere
// else (see the DEMO_APP gate at the top of convex/seed.ts).
crons.cron(
  'reset demo data every 7 days',
  // eslint-disable-next-line @convex-dev/no-top-of-hour-crons
  '0 0 */7 * *',
  internal.seed.resetDemoData,
  {},
)

export default crons
