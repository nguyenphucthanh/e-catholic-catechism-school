import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AttendanceTile } from './attendance-tile'
import type { AttendanceStatus } from './attendance-tile'

function renderTile(props: Partial<Parameters<typeof AttendanceTile>[0]> = {}) {
  const handlers = {
    onExpand: vi.fn(),
    onCollapse: vi.fn(),
    onSelect: vi.fn(),
  }
  const utils = render(
    <AttendanceTile
      id="tile-1"
      saintName="Anna"
      fullName="Nguyen An"
      subtitle="GLV1"
      status="present"
      expanded={false}
      {...handlers}
      {...props}
    />,
  )
  return { ...utils, ...handlers }
}

describe('AttendanceTile', () => {
  test('renders saint name, full name, subtitle and the id', () => {
    const { container } = renderTile()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Nguyen An')).toBeInTheDocument()
    expect(screen.getByText('GLV1')).toBeInTheDocument()
    expect(container.querySelector('#tile-1')).toBeInTheDocument()
  })

  test('omits the saint name when absent', () => {
    renderTile({ saintName: null })
    expect(screen.queryByText('Anna')).not.toBeInTheDocument()
    expect(screen.getByText('Nguyen An')).toBeInTheDocument()
  })

  test.each([
    ['present', 'lucide-circle-check'],
    ['late', 'lucide-clock'],
    ['unexcused_absence', 'lucide-circle-alert'],
    ['excused_absence', 'lucide-triangle-alert'],
  ] as Array<[AttendanceStatus, string]>)(
    'collapsed tile shows the %s icon',
    (status, iconClass) => {
      const { container } = renderTile({ status })
      const svg = container.querySelector('button svg')
      expect(svg?.getAttribute('class')).toContain(iconClass)
    },
  )

  test('collapsed: clicking the status button requests expand and shows no options', () => {
    const { container, onExpand } = renderTile()
    fireEvent.click(container.querySelector('button')!)
    expect(onExpand).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('attendance.status.late.short')).toBeNull()
  })

  test('expanded: lists every status and reports the selected one', () => {
    const { onSelect } = renderTile({ expanded: true })
    for (const k of [
      'present',
      'late',
      'unexcused_absence',
      'excused_absence',
    ]) {
      expect(
        screen.getByText(`attendance.status.${k}.short`),
      ).toBeInTheDocument()
    }
    fireEvent.click(screen.getByText('attendance.status.late.short'))
    expect(onSelect).toHaveBeenCalledWith('late')
    fireEvent.click(screen.getByText('attendance.status.excused_absence.short'))
    expect(onSelect).toHaveBeenLastCalledWith('excused_absence')
  })

  test('expanded: clicking the name panel collapses', () => {
    const { onCollapse } = renderTile({ expanded: true })
    fireEvent.click(screen.getByTitle('Nguyen An'))
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })
})
