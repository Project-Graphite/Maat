import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, query } from './api.js'
import { countdown, safeNext } from './format.js'
import { isFinal } from './verdicts.js'

describe('safeNext', () => {
  it('keeps paths on this site', () => {
    expect(safeNext('/problems/sum?contest=1')).toBe('/problems/sum?contest=1')
  })

  it('refuses anything that leaves the site', () => {
    for (const next of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '', null]) {
      expect(safeNext(next)).toBe('/')
    }
  })
})

describe('countdown', () => {
  it('shows hours, minutes and seconds', () => {
    expect(countdown((3600 + 2 * 60 + 5) * 1000)).toBe('01:02:05')
  })

  it('adds days when there are any', () => {
    expect(countdown((2 * 86400 + 30) * 1000)).toBe('2d 00:00:30')
  })

  it('never goes below zero', () => {
    expect(countdown(-5000)).toBe('00:00:00')
  })
})

describe('query', () => {
  it('leaves out empty values', () => {
    expect(query({ page: 2, search: '', status: undefined, difficulty: 'easy' })).toBe('?page=2&difficulty=easy')
    expect(query({ search: '' })).toBe('')
  })
})

describe('isFinal', () => {
  it('treats only waiting and running as unfinished', () => {
    expect(isFinal('PENDING')).toBe(false)
    expect(isFinal('RUNNING')).toBe(false)
    expect(isFinal('ACCEPTED')).toBe(true)
    expect(isFinal('SYSTEM_ERROR')).toBe(true)
  })
})

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('turns an error response into an ApiError with the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Nope' }), { status: 403 })))
    const error = await api('/x').catch((err) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.message).toBe('Nope')
  })

  it('explains a network failure plainly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await api('/x').catch((err) => err)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/Could not reach the server/)
  })

  it('returns null for an empty 204 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    expect(await api('/x', { method: 'DELETE' })).toBeNull()
  })
})
