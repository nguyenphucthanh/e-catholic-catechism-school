import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { SearchIcon } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { InputGroupAddon } from './ui/input-group'
import { Spinner } from './ui/spinner'
import type { Id } from '../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isCatechist } from '~/lib/permissions'
import { formatPersonName } from '~/lib/name'
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
}

export function HeaderSearch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const [inputValue, setInputValue] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(inputValue.trim()), 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const results = useQuery(
    api.search.globalSearch,
    requesterId && debouncedQuery
      ? { requesterId, query: debouncedQuery }
      : 'skip',
  )

  if (!isCatechist(user)) {
    return null
  }

  const studentItems: Array<SearchResultItem> = (results?.students ?? []).map(
    (s) => ({
      label: `${formatPersonName(s.saintName, s.fullName)} (${s.studentCode})`,
      value: `student:${s._id}`,
      to: `/students/${s._id}`,
    }),
  )

  const catechistItems: Array<SearchResultItem> = (
    results?.catechists ?? []
  ).map((c) => ({
    label: `${formatPersonName(c.saintName, c.fullName)} (${c.memberId})`,
    value: `catechist:${c._id}`,
    to: `/catechists/${c._id}`,
  }))

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
          {results === undefined && !!debouncedQuery ? (
            <Spinner />
          ) : (
            <SearchIcon />
          )}
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>{t('common.noResultsFound')}</ComboboxEmpty>
        <ComboboxList>
          {studentItems.length > 0 && (
            <ComboboxGroup items={studentItems}>
              <ComboboxLabel>{t('header.search.students')}</ComboboxLabel>
              <ComboboxCollection>
                {(item: SearchResultItem) => (
                  <ComboboxItem key={item.value} value={item.value}>
                    {item.label}
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
                  <ComboboxItem key={item.value} value={item.value}>
                    {item.label}
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
