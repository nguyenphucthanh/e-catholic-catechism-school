import { DataTable } from './data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '~/components/ui/checkbox'
import { Badge } from '~/components/ui/badge'

interface Student {
  id: string
  fullName: string
  class: string
  gender: 'male' | 'female'
  isActive: boolean
}

// 1. Define Column Definitions
const columns: Array<ColumnDef<Student>> = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'fullName',
    header: 'Full Name',
  },
  {
    accessorKey: 'class',
    header: 'Class',
  },
  {
    accessorKey: 'gender',
    header: 'Gender',
    cell: ({ row }) => (
      <span className="capitalize">{row.getValue('gender')}</span>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const active = row.getValue('isActive')
      return (
        <Badge variant={active ? 'default' : 'secondary'}>
          {active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
  },
]

const dummyData: Array<Student> = [
  {
    id: '1',
    fullName: 'Nguyen Van A',
    class: 'Chiên Con 1',
    gender: 'male',
    isActive: true,
  },
  {
    id: '2',
    fullName: 'Tran Thi B',
    class: 'Ấu Nhi 1',
    gender: 'female',
    isActive: true,
  },
  {
    id: '3',
    fullName: 'Le Van C',
    class: 'Thiếu Nhi 2',
    gender: 'male',
    isActive: false,
  },
  {
    id: '4',
    fullName: 'Pham Hoang D',
    class: 'Nghĩa Sĩ 3',
    gender: 'male',
    isActive: true,
  },
  {
    id: '5',
    fullName: 'Vuong Diem E',
    class: 'Hiệp Sĩ 1',
    gender: 'female',
    isActive: false,
  },
]

export function DataTableDemo() {
  return (
    <div className="flex flex-col gap-8 p-6 border rounded-xl bg-card">
      <div>
        <h2 className="text-xl font-bold mb-1">DataTable Examples</h2>
        <p className="text-sm text-muted-foreground">
          Headless integration of TanStack Table styled with Shadcn design
          system tokens.
        </p>
      </div>

      {/* Demo 1: Client Side State */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-md font-semibold">
            1. Client-Side Managed State
          </h3>
          <p className="text-xs text-muted-foreground">
            Pagination, sorting, filters, and selections are fully managed
            internally by the component state.
          </p>
        </div>
        <DataTable
          columns={columns}
          data={dummyData}
          searchColumnKey="fullName"
          searchPlaceholder="Filter by name..."
        />
      </div>

      {/* Documentation for controlled URL/Server synchronization */}
      <div className="flex flex-col gap-3 border-t">
        <div>
          <h3 className="text-md font-semibold">
            2. Controlled State (URL / Server Sync)
          </h3>
          <p className="text-xs text-muted-foreground">
            Synchronize table page index, page size, filters, and sorting to URL
            search parameters using TanStack Router.
          </p>
        </div>
        <div className="bg-muted p-4 rounded-lg overflow-x-auto">
          <pre className="text-xs text-muted-foreground font-mono leading-relaxed">
            {`// Example: Synchronizing with TanStack Router search params
import { useNavigate, useSearch } from "@tanstack/react-router"

export function ControlledDataTable() {
  const navigate = useNavigate()
  // 1. Read parameters from URL (e.g. from /students route)
  const search = useSearch({ from: "/_authenticated/students" })

  const pagination: PaginationState = {
    pageIndex: search.pageIndex ?? 0,
    pageSize: search.pageSize ?? 10,
  }

  const sorting: SortingState = search.sorting ?? []

  // 2. Define handler updates that push back state to URL
  const handlePaginationChange = (updater: any) => {
    const nextVal = typeof updater === "function" ? updater(pagination) : updater
    navigate({
      search: (prev: any) => ({
        ...prev,
        pageIndex: nextVal.pageIndex,
        pageSize: nextVal.pageSize,
      })
    })
  }

  const handleSortingChange = (updater: any) => {
    const nextVal = typeof updater === "function" ? updater(sorting) : updater
    navigate({
      search: (prev: any) => ({
        ...prev,
        sorting: nextVal,
      })
    })
  }

  return (
    <DataTable
      columns={columns}
      data={serverData}
      pageCount={totalServerPages} // Tells table to run in server mode
      pagination={pagination}
      onPaginationChange={handlePaginationChange}
      sorting={sorting}
      onSortingChange={handleSortingChange}
    />
  )
}`}
          </pre>
        </div>
      </div>
    </div>
  )
}
