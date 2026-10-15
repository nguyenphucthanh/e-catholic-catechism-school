import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AttendanceBottomBar } from './attendance-bottom-bar'

const onSearchChange = vi.fn()
const onCancel = vi.fn()
const onSave = vi.fn()

function bar(props: Partial<Parameters<typeof AttendanceBottomBar>[0]> = {}) {
  return render(
    <AttendanceBottomBar
      searchPlaceholder="Search…"
      search=""
      onSearchChange={onSearchChange}
      onCancel={onCancel}
      saveLabel="Save it"
      isSubmitting={false}
      {...props}
    />,
  )
}

describe('AttendanceBottomBar', () => {
  beforeEach(() => {
    onSearchChange.mockReset()
    onCancel.mockReset()
    onSave.mockReset()
  })

  it('shows placeholder, value, cancel and save label', () => {
    bar({ search: 'abc' })
    expect(screen.getByPlaceholderText('Search…')).toHaveValue('abc')
    expect(screen.getByText('common.cancel')).toBeInTheDocument()
    expect(screen.getByText('Save it')).toBeInTheDocument()
  })

  it('reports search changes', () => {
    bar()
    fireEvent.change(screen.getByPlaceholderText('Search…'), {
      target: { value: 'x' },
    })
    expect(onSearchChange).toHaveBeenCalledWith('x')
  })

  it('calls onCancel', () => {
    bar()
    fireEvent.click(screen.getByText('common.cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('with form: save is a submit button tied to that form', () => {
    bar({ form: 'my-form', onSave })
    const btn = screen.getByText('Save it').closest('button')!
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toHaveAttribute('form', 'my-form')
  })

  it('submits the associated form when clicked', () => {
    const submitted = vi.fn((e: Event) => e.preventDefault())
    const { container } = render(
      <>
        <form id="f" onSubmit={submitted as any} />
        <AttendanceBottomBar
          searchPlaceholder="s"
          search=""
          onSearchChange={onSearchChange}
          onCancel={onCancel}
          saveLabel="Save it"
          isSubmitting={false}
          form="f"
        />
      </>,
    )
    expect(container).toBeTruthy()
    fireEvent.click(screen.getByText('Save it'))
    expect(submitted).toHaveBeenCalledTimes(1)
  })

  it('without form: save is a plain button that calls onSave', () => {
    bar({ onSave })
    const btn = screen.getByText('Save it').closest('button')!
    expect(btn).toHaveAttribute('type', 'button')
    fireEvent.click(btn)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('disables save when saveDisabled', () => {
    bar({ saveDisabled: true, onSave })
    const btn = screen.getByText('Save it').closest('button')!
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('while saving: shows saving label and disables save and cancel', () => {
    bar({ isSubmitting: true })
    expect(screen.queryByText('Save it')).not.toBeInTheDocument()
    expect(screen.getByText('common.saving').closest('button')).toBeDisabled()
    expect(screen.getByText('common.cancel').closest('button')).toBeDisabled()
  })
})
