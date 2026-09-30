import { useCallback, useEffect, useState } from 'react'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

export const RECAPTCHA_SCRIPT_ID = 'google-recaptcha-v3-script'

export function useRecaptcha(customSiteKey?: string) {
  const [isLoaded, setIsLoaded] = useState(false)
  const siteKey = customSiteKey ?? import.meta.env.VITE_RECAPTCHA_SITE_KEY

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined') {
      return
    }

    if (window.grecaptcha) {
      window.grecaptcha.ready(() => setIsLoaded(true))
      return
    }

    let script = document.getElementById(
      RECAPTCHA_SCRIPT_ID,
    ) as HTMLScriptElement | null

    if (!script) {
      script = document.createElement('script')
      script.id = RECAPTCHA_SCRIPT_ID
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const onLoad = () => {
      window.grecaptcha?.ready(() => setIsLoaded(true))
    }

    script.addEventListener('load', onLoad)
    return () => {
      script.removeEventListener('load', onLoad)
    }
  }, [siteKey])

  const executeRecaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!siteKey || typeof window === 'undefined' || !window.grecaptcha) {
        return null
      }

      return new Promise<string | null>((resolve) => {
        window.grecaptcha?.ready(async () => {
          try {
            const token = await window.grecaptcha!.execute(siteKey, { action })
            resolve(token)
          } catch {
            resolve(null)
          }
        })
      })
    },
    [siteKey],
  )

  return {
    siteKey,
    isLoaded,
    executeRecaptcha,
  }
}
