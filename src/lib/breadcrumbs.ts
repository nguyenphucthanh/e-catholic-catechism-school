// Augments TanStack Router's staticData option so each route can declare
// an i18n key for its breadcrumb label, e.g. `staticData: { crumb: 'nav.dashboard' }`,
// or a full trail via `crumbs` for flat/undercore routes, e.g.
// `staticData: { crumbs: [{ label: 'classes.title', path: '/classes' }, { label: 'classes.create.title' }] }`.
export {}

declare module '@tanstack/router-core' {
  interface StaticDataRouteOption {
    crumb?: string
    crumbs?: Array<{ label: string; path?: string }>
  }
}
