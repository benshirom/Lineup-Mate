'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const CACHE_PREFIX = 'lm-cache'
// Bump this after schema/data-structure changes to invalidate all cached data
const CACHE_VERSION = 'v1'

type CacheEntry<T> = { data: T; savedAt: number }

function cacheKey(key: string) {
  return `${CACHE_PREFIX}:${CACHE_VERSION}:${key}`
}

function readCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(cacheKey(key))
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify({ data, savedAt: Date.now() }))
  } catch {
    // quota full — cache is a bonus, never throw
  }
}

/**
 * stale-while-revalidate:
 * 1. Returns cached data immediately (if any)
 * 2. Attempts a background network refresh
 * 3. Success → updates state + cache; failure → keeps stale data, sets isOffline=true
 */
export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const cached = readCache<T>(key)
  const [data, setData] = useState<T | null>(cached?.data ?? null)
  const [savedAt, setSavedAt] = useState<number | null>(cached?.savedAt ?? null)
  const [loading, setLoading] = useState(cached === null)
  const [isOffline, setIsOffline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetcherRef.current()
      writeCache(key, fresh)
      setData(fresh)
      setSavedAt(Date.now())
      setIsOffline(false)
    } catch {
      setIsOffline(true)
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    refresh()
    window.addEventListener('online', refresh)
    return () => window.removeEventListener('online', refresh)
  }, [refresh])

  return { data, loading, isOffline, savedAt, refresh }
}
