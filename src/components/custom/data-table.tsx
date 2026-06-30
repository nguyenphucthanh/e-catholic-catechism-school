import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export interface DataTableProps<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>
  data: Array<TData>

  // Controlled States (Optional for URL/Server sync)
  sorting?: SortingState
  onSortingChange?: React.Dispatch<React.SetStateAction<SortingState>>

  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: React.Dispatch<
    React.SetStateAction<ColumnFiltersState>
  >

  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: React.Dispatch<
    React.SetStateAction<VisibilityState>
  >

  rowSelection?: RowSelectionState
  onRowSelectionChange?: React.Dispatch<React.SetStateAction<RowSelectionState>>

  pagination?: PaginationState
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>
  pageCount?: number // Required for server-side manual pagination

  // Search Filter Options
  searchPlaceholder?: string
  searchColumnKey?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting: controlledSorting,
  onSortingChange,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  pagination: controlledPagination,
  onPaginationChange,
  pageCount,
  searchPlaceholder = 'Filter...',
  searchColumnKey,
}: DataTableProps<TData, TValue>) {
  // Local state fallbacks if properties are not controlled
  const [localSorting, setLocalSorting] = React.useState<SortingState>([])
  const [localColumnFilters, setLocalColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [localColumnVisibility, setLocalColumnVisibility] =
    React.useState<VisibilityState>({})
  const [localRowSelection, setLocalRowSelection] =
    React.useState<RowSelectionState>({})
  const [localPagination, setLocalPagination] = React.useState<PaginationState>(
    {
      pageIndex: 0,
      pageSize: 10,
    },
  )

  // Resolve state values and dispatch setters
  const sorting = controlledSorting ?? localSorting
  const setSorting = onSortingChange ?? setLocalSorting

  const columnFilters = controlledColumnFilters ?? localColumnFilters
  const setColumnFilters = onColumnFiltersChange ?? setLocalColumnFilters

  const columnVisibility = controlledColumnVisibility ?? localColumnVisibility
  const setColumnVisibility =
    onColumnVisibilityChange ?? setLocalColumnVisibility

  const rowSelection = controlledRowSelection ?? localRowSelection
  const setRowSelection = onRowSelectionChange ?? setLocalRowSelection

  const pagination = controlledPagination ?? localPagination
  const setPagination = onPaginationChange ?? setLocalPagination

  // Initialize Headless TanStack Table
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    // Bind state setters
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,

    // Core Row Models (client-side implementation)
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    // Handle server-side controlled mode overrides
    pageCount: pageCount,
    manualPagination: pageCount !== undefined,
    manualSorting: pageCount !== undefined,
    manualFiltering: pageCount !== undefined,
  })

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Filter Controls */}
      <div className="flex items-center justify-between gap-4">
        {searchColumnKey && (
          <Input
            placeholder={searchPlaceholder}
            value={
              (table.getColumn(searchColumnKey)?.getFilterValue() as
                string | undefined) ?? ''
            }
            onChange={(event) =>
              table
                .getColumn(searchColumnKey)
                ?.setFilterValue(event.target.value)
            }
            className="max-w-xs"
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="ml-auto flex gap-2"
              >
                <Settings2 className="size-4" />
                Columns
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Accessible Table Container */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bottom Selection Count & Pagination Controls */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex-1">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex gap-1"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <div className="flex items-center gap-1 font-medium text-foreground px-2">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount() || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex gap-1"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
