import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ResultPanel from './ResultPanel.jsx'

afterEach(cleanup)

describe('ResultPanel', () => {
  it('shows nothing before a submission', () => {
    const { container } = render(<ResultPanel result={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows that the code is being judged', () => {
    render(<ResultPanel result={null} waiting />)
    expect(screen.getByText('Waiting for a judge')).toBeTruthy()
  })

  it('lists every test of an accepted solution', () => {
    const tests = [
      { ordinal: 1, verdict: 'ACCEPTED', timeMs: 12 },
      { ordinal: 2, verdict: 'ACCEPTED', timeMs: 15 },
    ]
    render(<ResultPanel result={{ status: 'ACCEPTED', tests }} />)
    expect(screen.getByText('All 2 tests passed.')).toBeTruthy()
    expect(screen.getByText('Test 2')).toBeTruthy()
  })

  it('names the test that failed', () => {
    const tests = [
      { ordinal: 1, verdict: 'ACCEPTED', timeMs: 12 },
      { ordinal: 2, verdict: 'TLE', timeMs: 2000 },
    ]
    render(<ResultPanel result={{ status: 'TLE', tests }} />)
    expect(screen.getByText('Stopped at test 2.')).toBeTruthy()
  })

  it('shows the compiler output', () => {
    render(<ResultPanel result={{ status: 'COMPILE_ERROR', tests: [], compileOutput: 'main.cpp:1: error' }} />)
    expect(screen.getByText('main.cpp:1: error')).toBeTruthy()
  })

  it('asks to submit again after a judge error', () => {
    render(<ResultPanel result={{ status: 'SYSTEM_ERROR', tests: [] }} />)
    expect(screen.getByText(/Submit it again/)).toBeTruthy()
  })
})
