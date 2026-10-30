import * as React from 'react'
import { useConvex } from 'convex/react'
import { toast } from 'sonner'
import { getFunctionName } from 'convex/server'
import type { FunctionReference, FunctionReturnType } from 'convex/server'

// One-shot fetch with manual refresh. Use instead of `useQuery` for heavy
// queries that would otherwise re-run on every write to their read set.
export function useOneShotQuery<TQuery extends FunctionReference<'query'>>(
  query: TQuery,
  args: TQuery['_args'] | 'skip',
) {
  const convex = useConvex()
  const [data, setData] = React.useState<FunctionReturnType<TQuery>>()
  const [tick, setTick] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  // `api.*` refs are fresh proxy objects each render, so key on name + args.
  const queryKey = `${getFunctionName(query)}:${JSON.stringify(args)}`

  React.useEffect(() => {
    if (args === 'skip') return
    let cancelled = false
    setIsRefreshing(true)
    convex
      .query(query, args)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(String(err))
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false)
      })
    return () => {
      cancelled = true
    }
  }, [convex, queryKey, tick])

  const refresh = React.useCallback(() => setTick((n) => n + 1), [])
  return { data, isRefreshing, refresh }
}
