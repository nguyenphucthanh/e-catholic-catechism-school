import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IssuedCredentialsDialog } from './issued-credentials-dialog'
import { exportCredentialsCsv } from '~/lib/export'

vi.mock('~/lib/export', () => ({ exportCredentialsCsv: vi.fn() }))

const cred = { loginId: 'LOGIN1', password: 'PASS1' } as any
const writeText = vi.fn()

function single(onClose = vi.fn()) {
  render(
    <IssuedCredentialsDialog
      mode="single"
      credentials={cred}
      onClose={onClose}
    />,
  )
  return onClose
}
function bulk(onClose = vi.fn()) {
  render(
    <IssuedCredentialsDialog
      mode="bulk"
      credentials={[cred, cred]}
      csvAction="nhap"
      onClose={onClose}
    />,
  )
  return onClose
}

let addSpy: ReturnType<typeof vi.spyOn>
let removeSpy: ReturnType<typeof vi.spyOn>
const count = (spy: typeof addSpy) =>
  spy.mock.calls.filter((c) => c[0] === 'beforeunload').length

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  addSpy = vi.spyOn(window, 'addEventListener')
  removeSpy = vi.spyOn(window, 'removeEventListener')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(exportCredentialsCsv).mockClear()
})

describe('IssuedCredentialsDialog', () => {
  it('renders nothing when credentials are null', () => {
    render(
      <IssuedCredentialsDialog
        mode="single"
        credentials={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByText('issuedCredentials.title.single')).toBeNull()
  })

  it('shows login id and password in single mode', () => {
    single()
    expect(screen.getByDisplayValue('LOGIN1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('PASS1')).toBeInTheDocument()
  })

  it('does not close on Escape', () => {
    const onClose = single()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('issuedCredentials.title.single')).toBeVisible()
  })

  it('does not close on outside click', () => {
    const onClose = single()
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]')
    fireEvent.pointerDown(backdrop ?? document.body)
    fireEvent.click(backdrop ?? document.body)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('issuedCredentials.title.single')).toBeVisible()
  })

  it('asks for confirmation when closing before copying, then closes on confirm', async () => {
    const onClose = single()
    fireEvent.click(screen.getByText('issuedCredentials.close'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(
      await screen.findByText('issuedCredentials.confirmClose.confirm'),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when the confirmation is cancelled', async () => {
    const onClose = single()
    fireEvent.click(screen.getByText('issuedCredentials.close'))
    fireEvent.click(await screen.findByText('common.cancel'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes directly after copying a field', async () => {
    const onClose = single()
    fireEvent.click(screen.getAllByLabelText('common.copy')[0])
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('LOGIN1'))
    fireEvent.click(screen.getByText('issuedCredentials.close'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(
      screen.queryByText('issuedCredentials.confirmClose.title'),
    ).toBeNull()
  })

  it('copy both writes labelled login id and password', async () => {
    const onClose = single()
    fireEvent.click(screen.getByText('issuedCredentials.copyBoth'))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'issuedCredentials.loginId: LOGIN1\nissuedCredentials.password: PASS1',
      ),
    )
    fireEvent.click(screen.getByText('issuedCredentials.close'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('bulk: shows count, download exports then Close closes directly', async () => {
    const onClose = bulk()
    expect(screen.getByText('issuedCredentials.count')).toBeInTheDocument()
    fireEvent.click(screen.getByText('issuedCredentials.downloadCsv'))
    expect(exportCredentialsCsv).toHaveBeenCalledWith([cred, cred], 'nhap')
    fireEvent.click(screen.getByText('issuedCredentials.close'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('bulk: Close before download asks for confirmation', async () => {
    const onClose = bulk()
    fireEvent.click(screen.getByText('issuedCredentials.close'))
    expect(onClose).not.toHaveBeenCalled()
    expect(
      await screen.findByText('issuedCredentials.confirmClose.title'),
    ).toBeInTheDocument()
  })

  describe('beforeunload guard', () => {
    it('is registered while unsaved and removed on unmount', () => {
      single()
      expect(count(addSpy)).toBe(1)
      const handler = addSpy.mock.calls.find((c) => c[0] === 'beforeunload')![1]
      const ev = new Event('beforeunload', { cancelable: true })
      handler(ev)
      expect(ev.defaultPrevented).toBe(true)
    })

    it('is removed after copying', async () => {
      single()
      fireEvent.click(screen.getByText('issuedCredentials.copyBoth'))
      await waitFor(() => expect(count(removeSpy)).toBe(1))
    })

    it('is removed after downloading CSV', () => {
      bulk()
      fireEvent.click(screen.getByText('issuedCredentials.downloadCsv'))
      expect(count(removeSpy)).toBe(1)
    })

    it('is removed when the parent clears credentials', () => {
      const { rerender } = render(
        <IssuedCredentialsDialog
          mode="single"
          credentials={cred}
          onClose={vi.fn()}
        />,
      )
      rerender(
        <IssuedCredentialsDialog
          mode="single"
          credentials={null}
          onClose={vi.fn()}
        />,
      )
      expect(count(removeSpy)).toBe(1)
    })
  })
})
