import { useEffect, useState } from 'react'

/**
 * Returns true when the viewport is narrower than `breakpoint` px.
 * Updates on resize / orientation change.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  )

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [breakpoint])

  return isMobile
}
