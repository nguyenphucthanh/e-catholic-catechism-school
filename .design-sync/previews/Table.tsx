import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '~/components/ui/table'
import { Badge } from '~/components/ui/badge'

const students = [
  {
    name: 'Nguyễn Văn An',
    className: 'Sơ Cấp 1',
    status: 'Enrolled',
    attendance: '92%',
  },
  {
    name: 'Trần Thị Bình',
    className: 'Sơ Cấp 1',
    status: 'Enrolled',
    attendance: '88%',
  },
  {
    name: 'Lê Hoàng Cường',
    className: 'Chuyên Cần 2',
    status: 'Pending',
    attendance: '76%',
  },
  {
    name: 'Phạm Thị Dung',
    className: 'Chuyên Cần 2',
    status: 'Enrolled',
    attendance: '95%',
  },
]

export function Default() {
  return (
    <Table>
      <TableCaption>Students enrolled this academic year</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Attendance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.name}>
            <TableCell className="font-medium">{s.name}</TableCell>
            <TableCell>{s.className}</TableCell>
            <TableCell>
              <Badge
                variant={s.status === 'Enrolled' ? 'default' : 'secondary'}
              >
                {s.status}
              </Badge>
            </TableCell>
            <TableCell>{s.attendance}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
