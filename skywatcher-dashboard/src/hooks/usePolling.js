import { useState, useEffect, useCallback } from 'react'

/**
 * usePolling — fetch data on an interval, return { data, loading, error, refresh }
 * @param {Function} fetchFn  — async function that returns data
 * @param {number}   interval — polling interval in ms (default 3000)
 */
export function usePolling(fetchFn, interval = 3000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message || 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, interval)
    return () => clearInterval(id)
  }, [refresh, interval])

  return { data, loading, error, refresh }
}
