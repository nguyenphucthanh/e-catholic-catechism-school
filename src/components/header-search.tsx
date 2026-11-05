import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Cake,
  GraduationCap,
  Presentation,
  SearchIcon,
  UserIcon,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { InputGroupAddon } from './ui/input-group'
import { Spinner } from './ui/spinner'
import { Badge } from './ui/badge'
import { useAuth } from '~/lib/auth'
import { useOneShotQuery } from '~/hooks/use-one-shot-query'
import { isCatechist } from '~/lib/permissions'
import { formatPersonName } from '~/lib/name'
import { formatDate } from '~/lib/locale'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '~/components/ui/combobox'

type SearchResultItem = {
  label: string
  value: string
  to: string
  icon: React.ReactNode
  content: React.ReactNode
}

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 100

export function HeaderSearch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [inputValue, setInputValue] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')

  React.useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(inputValue.trim().slice(0, MAX_QUERY_LENGTH)),
      300,
    )
    return () => clearTimeout(timer)
  }, [inputValue])

  // One-shot: results needn't be live, so skip re-runs on unrelated writes.
  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH
  const { data, isRefreshing } = useOneShotQuery(
    api.search.globalSearch,
    enabled ? { query: debouncedQuery } : 'skip',
  )
  const results = enabled ? data : undefined

  if (!isCatechist(user)) {
    return null
  }

  const studentItems: Array<SearchResultItem> = (results?.students ?? []).map(
    (s) => {
      const name = formatPersonName(s.saintName, s.fullName)
      return {
        label: `${name} (${s.studentCode})`,
        value: `student:${s._id}`,
        to: `/students/${s._id}`,
        icon: <UserIcon />,
        content: (
          <>
            <span className="flex items-center gap-2">
              <span className="truncate">{name}</span>
              <Badge variant="secondary">{s.studentCode}</Badge>
            </span>
            {(s.dateOfBirth || s.primaryClassName) && (
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {s.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    <Cake className="size-3" />
                    {formatDate(s.dateOfBirth, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                )}
                {s.primaryClassName && (
                  <span className="flex items-center gap-1">
                    <Presentation className="size-3" />
                    {s.primaryClassName}
                  </span>
                )}
              </span>
            )}
          </>
        ),
      }
    },
  )

  const catechistItems: Array<SearchResultItem> = (
    results?.catechists ?? []
  ).map((c) => {
    const name = formatPersonName(c.saintName, c.fullName)
    return {
      label: `${name} (${c.memberId})`,
      value: `catechist:${c._id}`,
      to: `/catechists/${c._id}`,
      icon: <GraduationCap />,
      content: (
        <span className="flex items-center gap-2">
          <span className="truncate">{name}</span>
          <Badge variant="secondary">{c.memberId}</Badge>
        </span>
      ),
    }
  })

  const allItems = [...studentItems, ...catechistItems]

  const handleValueChange = (value: string | null) => {
    const item = allItems.find((i) => i.value === value)
    if (!item) return
    setInputValue('')
    setDebouncedQuery('')
    void navigate({ to: item.to })
  }

  return (
    <Combobox
      value={null as string | null}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      items={allItems.map((i) => ({ label: i.label, value: i.value }))}
      filter={null}
    >
      <ComboboxInput
        placeholder={t('header.search.placeholder')}
        className="w-56 sm:w-72"
      >
        <InputGroupAddon>
          {isRefreshing ? <Spinner /> : <SearchIcon />}
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent className="max-sm:w-screen shadow-2xl">
        <ComboboxEmpty>{t('common.noResultsFound')}</ComboboxEmpty>
        <ComboboxList>
          {studentItems.length > 0 && (
            <ComboboxGroup items={studentItems}>
              <ComboboxLabel>{t('header.search.students')}</ComboboxLabel>
              <ComboboxCollection>
                {(item: SearchResultItem) => (
                  <ComboboxItem
                    key={item.value}
                    value={item.value}
                    className="flex items-center gap-2"
                  >
                    {item.icon}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {item.content}
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
          {catechistItems.length > 0 && (
            <ComboboxGroup items={catechistItems}>
              <ComboboxLabel>{t('header.search.catechists')}</ComboboxLabel>
              <ComboboxCollection>
                {(item: SearchResultItem) => (
                  <ComboboxItem
                    key={item.value}
                    value={item.value}
                    className="flex items-center gap-2"
                  >
                    {item.icon}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {item.content}
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
