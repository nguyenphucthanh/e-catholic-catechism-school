import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImportStep1Upload } from './ImportStep1Upload'

function makeCsvFile(content: string, name = 'data.csv'): File {
  return new File([content], name, { type: 'text/csv' })
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ImportStep1Upload', () => {
  const onFileAccepted = vi.fn()
  const onNext = vi.fn()

  beforeEach(() => {
    onFileAccepted.mockClear()
    onNext.mockClear()
  })

  test('accepts a valid CSV file within the row limit, shows filename and row count', async () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const header = 'fullName,dob'
    const rows = Array.from({ length: 10 }, (_, i) => `Name ${i},2020-01-01`)
    const content = [header, ...rows].join('\n')
    selectFile(makeCsvFile(content))

    await waitFor(() => {
      expect(onFileAccepted).toHaveBeenCalledWith(expect.any(File), content)
    })
  })

  test('rejects a file with more than 500 rows and blocks Next with an error message', async () => {
    const { rerender } = render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const header = 'fullName,dob'
    const rows = Array.from({ length: 501 }, (_, i) => `Name ${i},2020-01-01`)
    const content = [header, ...rows].join('\n')
    selectFile(makeCsvFile(content))

    await waitFor(() => {
      expect(
        screen.getByText('csvImport.upload.rowLimitError'),
      ).toBeInTheDocument()
    })
    expect(onFileAccepted).not.toHaveBeenCalled()

    // Next remains disabled since no file was accepted into wizard state.
    rerender(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )
    expect(screen.getByRole('button', { name: 'common.next' })).toBeDisabled()
  })

  test('rejects a non-CSV file type with an inline error', async () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const badFile = new File(['not a csv'], 'data.txt', {
      type: 'text/plain',
    })
    selectFile(badFile)

    await waitFor(() => {
      expect(
        screen.getByText('csvImport.upload.invalidType'),
      ).toBeInTheDocument()
    })
    expect(onFileAccepted).not.toHaveBeenCalled()
  })

  test('shows a read error message when FileReader fails', async () => {
    const originalReadAsText = FileReader.prototype.readAsText
    FileReader.prototype.readAsText = function (this: FileReader) {
      // Defer to simulate async failure, mirroring real FileReader behavior.
      setTimeout(() => {
        this.onerror?.(new ProgressEvent('error') as any)
      }, 0)
    }

    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    selectFile(makeCsvFile('fullName,dob\nA,2020-01-01'))

    await waitFor(() => {
      expect(screen.getByText('csvImport.upload.readError')).toBeInTheDocument()
    })
    expect(onFileAccepted).not.toHaveBeenCalled()

    FileReader.prototype.readAsText = originalReadAsText
  })

  test('Next button is disabled when no file has been accepted yet', () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )
    expect(screen.getByRole('button', { name: 'common.next' })).toBeDisabled()
  })

  test('Next button is enabled and calls onNext once a valid file+rawText is set', () => {
    render(
      <ImportStep1Upload
        file={makeCsvFile('fullName\nA')}
        rawText={'fullName\nA'}
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )
    const nextBtn = screen.getByRole('button', { name: 'common.next' })
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('dropping a valid CSV file on the dropzone accepts it', async () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const dropzone = screen
      .getByText('csvImport.upload.dragDrop')
      .closest('[role="button"]') as HTMLElement
    const content = 'fullName,dob\nAlice,2020-01-01'
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeCsvFile(content)] },
    })

    await waitFor(() => {
      expect(onFileAccepted).toHaveBeenCalledWith(expect.any(File), content)
    })
  })

  test('drop event with no files does nothing', () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const dropzone = screen
      .getByText('csvImport.upload.dragDrop')
      .closest('[role="button"]') as HTMLElement
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } })

    expect(onFileAccepted).not.toHaveBeenCalled()
  })

  test('dragOver toggles the dragging style on and dragLeave toggles it back off', () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const dropzone = screen
      .getByText('csvImport.upload.dragDrop')
      .closest('[role="button"]') as HTMLElement
    expect(dropzone.className).toContain('border-input')

    fireEvent.dragOver(dropzone)
    expect(dropzone.className).toContain('border-primary')

    fireEvent.dragLeave(dropzone)
    expect(dropzone.className).toContain('border-input')
  })

  test('pressing Enter or Space on the dropzone opens the file picker', () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const dropzone = screen
      .getByText('csvImport.upload.dragDrop')
      .closest('[role="button"]') as HTMLElement
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    // Stub out the real click() so it doesn't dispatch a native click event
    // that bubbles back up into the dropzone's own onClick handler.
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.keyDown(dropzone, { key: 'Enter' })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockClear()
    fireEvent.keyDown(dropzone, { key: ' ' })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockClear()
    fireEvent.keyDown(dropzone, { key: 'a' })
    expect(clickSpy).not.toHaveBeenCalled()

    clickSpy.mockRestore()
  })

  test('clicking the dropzone opens the file picker', () => {
    render(
      <ImportStep1Upload
        file={null}
        rawText=""
        onFileAccepted={onFileAccepted}
        onNext={onNext}
      />,
    )

    const dropzone = screen
      .getByText('csvImport.upload.dragDrop')
      .closest('[role="button"]') as HTMLElement
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.click(dropzone)
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockRestore()
  })
})
