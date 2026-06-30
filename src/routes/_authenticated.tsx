import * as React from 'react'
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'
import { Separator } from '~/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '~/components/ui/sidebar'
import { AppSidebar } from '~/components/app-sidebar'
import { useAuth } from '~/lib/auth'
import { SEGMENT_LABELS } from '~/lib/breadcrumbs'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { pathname } = useLocation()

  if (!user) {
    return <Navigate to="/login" />
  }

  const crumbs = pathname
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: t(SEGMENT_LABELS[seg] ?? seg),
      path: '/' + arr.slice(0, i + 1).join('/'),
      isCurrent: i === arr.length - 1,
    }))

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} onLogout={handleLogout} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((crumb, i) => (
                  <React.Fragment key={crumb.path}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.isCurrent ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link to={crumb.path} />}>
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
