import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  CalendarRange,
  ChevronsUpDown,
  ClipboardList,
  GitBranch,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Lock,
  LogOut,
  Shield,
  ShieldCheck,
  Star,
  UserCircle,
  UserCog,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import type { AuthUser } from '~/lib/auth'
import { YearSwitcher } from '~/components/year-switcher'
import { setLanguage } from '~/lib/i18n'
import { isAdmin, isCatechist } from '~/lib/permissions'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '~/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'

function NavUser({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(-2)
    .join('')
    .toUpperCase()

  const trigger = (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          ID: {user.memberId.toString().padStart(6, '0')}
        </span>
      </div>
      <ChevronsUpDown className="ml-auto size-4" />
    </SidebarMenuButton>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={trigger} />
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user.fullName}
                    </span>
                    <span className="truncate text-xs">
                      ID: {user.memberId.toString().padStart(6, '0')}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link to="/profile" />}>
                <UserCircle />
                {t('nav.profile')}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/change-password" />}>
                <Lock />
                {t('password.title')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLanguage('vi')}>
                <Languages />
                {t('lang.vi')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('en')}>
                <Languages />
                {t('lang.en')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({
  user,
  onLogout,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: AuthUser
  onLogout: () => void
}) {
  const { t } = useTranslation()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const myClasses = useQuery(
    api.classes.listMyClasses,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const navItems = [
    {
      title: t('nav.dashboard'),
      url: '/dashboard',
      icon: LayoutDashboard,
    },
  ]

  if (isCatechist(user)) {
    navItems.push(
      {
        title: t('nav.assignments'),
        url: '/assignments',
        icon: ClipboardList,
      },
      {
        title: t('nav.students'),
        url: '/students',
        icon: Users,
      },
      {
        title: t('catechists.title'),
        url: '/catechists',
        icon: Users,
      },
      {
        title: t('nav.classes'),
        url: '/classes',
        icon: GraduationCap,
      },
      {
        title: t('nav.branches'),
        url: '/branches',
        icon: GitBranch,
      },
    )
  }

  const adminItems = isAdmin(user)
    ? [
        {
          title: t('nav.academicYears'),
          url: '/academic-years',
          icon: CalendarRange,
        },
        {
          title: t('nav.admin.catechistAccounts'),
          url: '/admin/catechist-accounts',
          icon: UserCog,
        },
        {
          title: t('nav.admin.studentAccounts'),
          url: '/admin/student-accounts',
          icon: ShieldCheck,
        },
      ]
    : []

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-xs">
                GL
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{t('app.name')}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t('app.tagline')}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
          <YearSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.label')}</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  render={<Link to={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Shield className="mr-2 size-4" />
              {t('nav.admin')}
            </SidebarGroupLabel>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    render={<Link to={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.myClasses')}</SidebarGroupLabel>
          <SidebarMenu>
            {myClasses === undefined ? (
              <SidebarMenuItem>
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t('common.loading')}
                </div>
              </SidebarMenuItem>
            ) : myClasses.length > 0 ? (
              myClasses.map((cls) => (
                <SidebarMenuItem key={cls.classId}>
                  <SidebarMenuButton
                    tooltip={cls.className}
                    render={
                      <Link to="/classes/$id" params={{ id: cls.classId }} />
                    }
                  >
                    <Star />
                    <span>{cls.className}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            ) : (
              <SidebarMenuItem>
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t('nav.myClasses.empty')}
                </div>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
