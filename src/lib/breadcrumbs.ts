// Augments TanStack Router's staticData option so each route can declare
// an i18n key for its breadcrumb label, e.g. `staticData: { crumb: 'nav.dashboard' }`.
export {}

declare module '@tanstack/router-core' {
  interface StaticDataRouteOption {
    crumb?: string
  }
}
