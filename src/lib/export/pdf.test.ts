import { describe, expect, it, vi } from 'vitest'
import pdfMake from './pdfmake-instance'
import {
  buildBranchesPdf,
  buildClassesPdf,
  buildFullAssignmentsPdf,
  buildPdfDocDefinition,
  exportBranchesPdf,
  exportClassesPdf,
  exportFullAssignmentsPdf,
  exportPdf,
} from './pdf'

vi.mock('./pdfmake-instance', () => ({
  default: {
    createPdf: vi.fn(),
  },
}))

describe('pdf export helpers', () => {
  const downloadMock = vi.fn()

  vi.mocked(pdfMake.createPdf).mockReturnValue({
    download: downloadMock,
  } as any)

  it('buildPdfDocDefinition creates valid document definition and configures bordered table layout', () => {
    const rows = [{ col1: 'val1', col2: 'val2' }]
    const meta = { 'Academic Year': '2024-2025' }
    const headers = ['col1', 'col2']

    const doc = buildPdfDocDefinition(rows, 'Test Document', meta, headers)

    expect(doc.content).toBeDefined()
    expect(doc.styles).toBeDefined()

    const tableContent = (doc.content as Array<any>)[2]
    const layout = tableContent.layout
    expect(layout.hLineWidth()).toBe(1)
    expect(layout.vLineWidth()).toBe(1)
    expect(layout.hLineColor()).toBe('#000')
    expect(layout.vLineColor()).toBe('#000')
    expect(layout.paddingLeft()).toBe(6)
    expect(layout.paddingRight()).toBe(6)
    expect(layout.paddingTop()).toBe(4)
    expect(layout.paddingBottom()).toBe(4)
  })

  it('exportPdf calls pdfMake.createPdf and download', () => {
    exportPdf([], 'Title', {}, 'output.pdf', ['h1'])
    expect(pdfMake.createPdf).toHaveBeenCalled()
    expect(downloadMock).toHaveBeenCalledWith('output.pdf')
  })

  it('buildBranchesPdf builds branch document definition', () => {
    const branches = [
      {
        branchName: 'Branch 1',
        branchHeads: [{ fullName: 'John', saintName: 'St. John' }],
      },
      {
        branchName: 'Branch 2',
        branchHeads: [],
      },
    ]
    const labels = { branchCol: 'Branch', branchHeadsCol: 'Heads' }

    const doc = buildBranchesPdf(branches, 'Branches List', {}, labels)
    expect(doc.content).toBeDefined()
  })

  it('exportBranchesPdf triggers pdf export download', () => {
    exportBranchesPdf([], 'Title', {}, 'branches.pdf', {
      branchCol: 'B',
      branchHeadsCol: 'H',
    })
    expect(downloadMock).toHaveBeenCalledWith('branches.pdf')
  })

  it('buildClassesPdf builds class group document definition', () => {
    const branchGroups = [
      {
        branchName: 'Branch A',
        classes: [
          {
            className: 'Class 101',
            homeroom: { fullName: 'Teacher 1' },
            coTeachers: [{ fullName: 'Teacher 2' }],
          },
        ],
      },
      {
        branchName: 'Branch B',
        classes: [],
      },
    ]
    const labels = {
      classCol: 'Class',
      homeroomCol: 'Homeroom',
      coTeachersCol: 'Co-Teachers',
    }

    const doc = buildClassesPdf(branchGroups, 'Classes List', {}, labels)
    expect(doc.content).toBeDefined()
  })

  it('exportClassesPdf triggers download', () => {
    exportClassesPdf([], 'Title', {}, 'classes.pdf', {
      classCol: 'C',
      homeroomCol: 'H',
      coTeachersCol: 'Co',
    })
    expect(downloadMock).toHaveBeenCalledWith('classes.pdf')
  })

  it('buildFullAssignmentsPdf builds full assignment doc definition', () => {
    const boardMembers = [{ fullName: 'Member 1' }]
    const branches = [
      {
        branchName: 'Branch A',
        branchHeads: [{ fullName: 'Head 1' }],
        classes: [
          {
            className: 'Class 1',
            homeroom: { fullName: 'Homeroom 1' },
            coTeachers: [],
          },
        ],
      },
      {
        branchName: 'Empty Branch',
        branchHeads: [],
        classes: [],
      },
    ]
    const labels = {
      boardMembers: 'Board Members',
      branchHeadsPrefix: 'Heads: ',
      classCol: 'Class',
      homeroomCol: 'Homeroom',
      coTeachersCol: 'Co-Teachers',
      noClasses: 'No classes',
    }

    const doc = buildFullAssignmentsPdf(
      boardMembers,
      branches,
      'Assignments',
      {},
      labels,
    )
    expect(doc.content).toBeDefined()
  })

  it('exportFullAssignmentsPdf triggers download', () => {
    exportFullAssignmentsPdf([], [], 'Title', {}, 'assignments.pdf', {
      boardMembers: 'BM',
      branchHeadsPrefix: 'BH',
      classCol: 'C',
      homeroomCol: 'H',
      coTeachersCol: 'CT',
      noClasses: 'NC',
    })
    expect(downloadMock).toHaveBeenCalledWith('assignments.pdf')
  })
})
