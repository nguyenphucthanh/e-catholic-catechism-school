import studentVi from './student.vi-VN.md?raw'
import studentEn from './student.en-US.md?raw'
import catechistVi from './catechist.vi-VN.md?raw'
import catechistEn from './catechist.en-US.md?raw'
import branchHeadVi from './branch-head.vi-VN.md?raw'
import branchHeadEn from './branch-head.en-US.md?raw'
import boardMemberVi from './board-member.vi-VN.md?raw'
import boardMemberEn from './board-member.en-US.md?raw'
import adminVi from './admin.vi-VN.md?raw'
import adminEn from './admin.en-US.md?raw'

export const HELP_CONTENT = {
  student: {
    'vi-VN': studentVi,
    'en-US': studentEn,
  },
  catechist: {
    'vi-VN': catechistVi,
    'en-US': catechistEn,
  },
  'branch-head': {
    'vi-VN': branchHeadVi,
    'en-US': branchHeadEn,
  },
  'board-member': {
    'vi-VN': boardMemberVi,
    'en-US': boardMemberEn,
  },
  admin: {
    'vi-VN': adminVi,
    'en-US': adminEn,
  },
} as const

export type HelpRole = keyof typeof HELP_CONTENT
export const HELP_ROLES: Array<HelpRole> = [
  'student',
  'catechist',
  'branch-head',
  'board-member',
  'admin',
]

export const ROLE_NAMES = {
  student: {
    'vi-VN': 'Học sinh (Thiếu nhi)',
    'en-US': 'Student (Youth)',
  },
  catechist: {
    'vi-VN': 'Giáo lý viên',
    'en-US': 'Catechist',
  },
  'branch-head': {
    'vi-VN': 'Phân đoàn trưởng',
    'en-US': 'Branch Head',
  },
  'board-member': {
    'vi-VN': 'Ban trị sự',
    'en-US': 'Board Member',
  },
  admin: {
    'vi-VN': 'Quản trị viên',
    'en-US': 'System Admin',
  },
} as const

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '') // remove special characters
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export interface SearchIndexNode {
  role: HelpRole
  roleName: string
  heading: string
  content: string
  id: string
}

export function parseMarkdownToSections(
  role: HelpRole,
  lang: 'vi-VN' | 'en-US',
  mdText: string,
): Array<SearchIndexNode> {
  const lines = mdText.split('\n')
  const sections: Array<SearchIndexNode> = []
  let currentHeading = ''
  let currentContentLines: Array<string> = []

  const roleName = ROLE_NAMES[role][lang]

  for (const line of lines) {
    if (line.startsWith('#')) {
      // If we had content for a previous heading, save it
      if (currentHeading || currentContentLines.length > 0) {
        sections.push({
          role,
          roleName,
          heading: currentHeading || roleName,
          content: currentContentLines.join(' ').trim(),
          id: currentHeading ? slugify(currentHeading) : '',
        })
      }
      // Parse new heading
      const cleanHeading = line.replace(/^#+\s+/, '').trim()
      currentHeading = cleanHeading
      currentContentLines = []
    } else {
      const cleanLine = line.trim()
      if (cleanLine && !cleanLine.startsWith('---')) {
        currentContentLines.push(cleanLine)
      }
    }
  }

  // Push final section
  if (currentHeading || currentContentLines.length > 0) {
    sections.push({
      role,
      roleName,
      heading: currentHeading || roleName,
      content: currentContentLines.join(' ').trim(),
      id: currentHeading ? slugify(currentHeading) : '',
    })
  }

  return sections
}

export function extractHeadings(
  mdText: string,
): Array<{ level: number; text: string; id: string }> {
  const lines = mdText.split('\n')
  const headings: Array<{ level: number; text: string; id: string }> = []

  for (const line of lines) {
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        headings.push({
          level,
          text,
          id: slugify(text),
        })
      }
    }
  }
  return headings
}
