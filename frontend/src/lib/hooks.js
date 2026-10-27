import { useEffect, useState } from 'react'
import { api } from './api.js'
import { getSocket } from './socket.js'
import { isFinal } from './verdicts.js'

// Runs `loader(signal)` whenever `deps` change and keeps the loading and error state.
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    loader(controller.signal).then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false })
      },
    )
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload: () => setTick((t) => t + 1) }
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// A clock that ticks, for countdowns
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

const POLL_DELAYS = [2000, 3000, 5000, 10000, 20000, 30000]
const POLL_GIVE_UP_MS = 10 * 60 * 1000

/**
 * Follows one submission until it has a final verdict. The verdict arrives over the socket
 * the moment the judge finishes. Polling runs alongside it with growing gaps, so a dropped
 * connection or a missed event never leaves the page waiting forever.
 */
export function useSubmissionStream(id, initial = null) {
  const [result, setResult] = useState(initial)

  useEffect(() => {
    setResult(initial)
    if (!id) return undefined
    if (initial && isFinal(initial.status)) return undefined

    let finished = false
    let timer
    const startedAt = Date.now()
    const socket = getSocket()

    const finish = (next) => {
      finished = true
      setResult(next)
    }

    const onVerdict = (verdict) => {
      if (verdict.submissionId === id) finish(verdict)
    }
    const watch = () => socket.emit('submission:watch', id, () => {})

    const poll = async (attempt) => {
      if (finished || Date.now() - startedAt > POLL_GIVE_UP_MS) return
      try {
        const res = await api(`/submissions/${id}`)
        const submission = res.data.submission
        if (isFinal(submission.status)) return finish(submission)
        setResult((current) => (current && isFinal(current.status) ? current : submission))
      } catch {
        // Try again on the next round
      }
      timer = setTimeout(() => poll(attempt + 1), POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)])
    }

    socket.on('submission:verdict', onVerdict)
    socket.on('connect', watch)
    if (socket.connected) watch()
    timer = setTimeout(() => poll(0), POLL_DELAYS[0])

    return () => {
      finished = true
      clearTimeout(timer)
      socket.off('submission:verdict', onVerdict)
      socket.off('connect', watch)
      socket.emit('submission:unwatch', id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return result
}
