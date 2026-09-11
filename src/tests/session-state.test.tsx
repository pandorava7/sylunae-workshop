// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionState } from '../lib/usePersistentState'

function SessionStateHarness() {
  const [page, setPage] = useSessionState('navigation.testPage', 'home')
  return <button onClick={() => setPage('notes')}>{page}</button>
}

describe('session navigation state', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('starts at home in a new window session', () => {
    render(<SessionStateHarness />)
    expect(screen.getByRole('button').textContent).toBe('home')
  })

  it('restores the current page after a renderer reload', () => {
    window.sessionStorage.setItem('navigation.testPage', JSON.stringify('music'))
    render(<SessionStateHarness />)
    expect(screen.getByRole('button').textContent).toBe('music')
    fireEvent.click(screen.getByRole('button'))
    expect(window.sessionStorage.getItem('navigation.testPage')).toBe(JSON.stringify('notes'))
  })
})
