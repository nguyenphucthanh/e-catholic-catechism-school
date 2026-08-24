import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  CATECHIST_FIELDS,
  GUARDIAN_CONTACT_FIELD_RE,
  GUARDIAN_FIELD_RE,
  GUARDIAN_NAME_FIELD_RE,
  GUARDIAN_SLOT_ROLE_LABEL_KEY,
  SACRAMENT_FIELD_RE,
  STUDENT_FIELDS,
} from './csvFieldDefinitions'
import type { ContactType, FieldDef } from './csvFieldDefinitions'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '~/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

const SKIP_VALUE = '__skip__'

const CONTACT_TYPE_ITEMS: Array<{ value: ContactType; labelKey: string }> = [
  { value: 'phone', labelKey: 'csvImport.columnMap.contactType.phone' },
  { value: 'email', labelKey: 'csvImport.columnMap.contactType.email' },
  { value: 'zalo', labelKey: 'csvImport.columnMap.contactType.zalo' },
  { value: 'other', labelKey: 'csvImport.columnMap.contactType.other' },
]

// A "category" bundles a guardian role (Father/Mother/Guardian) or a
// sacrament into one top-level option. Picking it reveals a second select
// for the specific field, instead of listing every field flat.
type Category = {
  key: string
  label: string
  fields: Array<{ value: string; label: string }>
}

function categoryKeyForField(field: FieldDef): string | null {
  const guardianMatch = GUARDIAN_FIELD_RE.exec(field.key)
  if (guardianMatch) return `guardian:${guardianMatch[1]}`
  const sacramentMatch = SACRAMENT_FIELD_RE.exec(field.key)
  if (sacramentMatch) return `sacrament:${sacramentMatch[1]}`
  return null
}

function buildCategories(
  fieldDefs: Array<FieldDef>,
  t: (key: string, fallback?: string) => string = (key) => key,
): Array<Category> {
  const byKey = new Map<string, Category>()
  for (const field of fieldDefs) {
    const categoryKey = categoryKeyForField(field)
    if (!categoryKey) continue
    let category = byKey.get(categoryKey)
    if (!category) {
      const [kind, id] = categoryKey.split(':')
      const label =
        kind === 'guardian'
          ? t(GUARDIAN_SLOT_ROLE_LABEL_KEY[Number(id)], id)
          : t(`csvImport.columnMap.sacramentType.${id}`, id)
      category = { key: categoryKey, label, fields: [] }
      byKey.set(categoryKey, category)
    }
    category.fields.push({
      value: field.key,
      label: t(field.labelKey, field.key),
    })
  }
  return [...byKey.values()]
}

interface ImportStep3ColumnMapProps {
  csvHeaders: Array<string>
  target: 'students' | 'catechists'
  columnMapping: Record<string, string | null>
  onMappingChange: (mapping: Record<string, string | null>) => void
  relationshipBySlot: Record<number, string>
  onRelationshipChange: (slot: number, value: string) => void
  contactTypeByField: Record<string, ContactType>
  onContactTypeChange: (fieldKey: string, type: ContactType) => void
  onNext: () => void
  onBack: () => void
}

export function ImportStep3ColumnMap({
  csvHeaders,
  target,
  columnMapping,
  onMappingChange,
  relationshipBySlot,
  onRelationshipChange,
  contactTypeByField,
  onContactTypeChange,
  onNext,
  onBack,
}: ImportStep3ColumnMapProps) {
  const { t } = useTranslation()
  const fieldDefs = target === 'students' ? STUDENT_FIELDS : CATECHIST_FIELDS

  // Fields that don't belong to a guardian/sacrament category stay a flat,
  // single-level choice (core student/catechist fields, contact fields).
  const leafItems = React.useMemo(
    () =>
      fieldDefs
        .filter((f) => categoryKeyForField(f) === null)
        .map((f) => ({ value: f.key, label: t(f.labelKey, f.key) })),
    [fieldDefs, t],
  )

  const categories = React.useMemo(
    () =>
      buildCategories(
        fieldDefs,
        t as (key: string, fallback?: string) => string,
      ),
    [fieldDefs, t],
  )

  const firstSelectItems = React.useMemo(
    () => [
      {
        value: SKIP_VALUE,
        label: t('csvImport.columnMap.skip', '— Skip (do not import) —'),
      },
      ...leafItems,
      ...categories.map((c) => ({
        value: c.key,
        label: `${c.label} (${c.fields.length} ${t('csvImport.columnMap.subfields', 'subfields')})`,
      })),
    ],
    [leafItems, categories, t],
  )

  // A category (Father/Mother/Guardian/a sacrament) picked but with no
  // specific field chosen yet, keyed by CSV header. Not part of
  // columnMapping since it doesn't resolve to a real target field on its
  // own — only its second-level field selection does.
  const [pendingCategoryByHeader, setPendingCategoryByHeader] = React.useState<
    Record<string, string | undefined>
  >({})

  const setMapping = (header: string, fieldKey: string) => {
    onMappingChange({
      ...columnMapping,
      [header]: fieldKey === SKIP_VALUE ? null : fieldKey,
    })
  }

  const mappedFieldCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    csvHeaders.forEach((h) => {
      const val = columnMapping[h]
      if (val) counts[val] = (counts[val] ?? 0) + 1
    })
    return counts
  }, [columnMapping, csvHeaders])

  const fullNameMapped = Object.values(columnMapping).includes('fullName')
  const hasDuplicateMapping = Object.values(mappedFieldCounts).some(
    (c) => c > 1,
  )
  const canProceed = fullNameMapped && !hasDuplicateMapping

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t('csvImport.columnMap.csvColumn', 'CSV Column')}
              </TableHead>
              <TableHead>
                {t('csvImport.columnMap.mapsTo', 'Maps to')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {csvHeaders.map((header) => {
              const mappedValue = columnMapping[header] ?? SKIP_VALUE
              const fieldDef = fieldDefs.find((f) => f.key === mappedValue)
              const isDuplicate = fieldDef
                ? (mappedFieldCounts[fieldDef.key] ?? 0) > 1
                : false
              const nameSlotMatch = fieldDef
                ? GUARDIAN_NAME_FIELD_RE.exec(fieldDef.key)
                : null
              const contactSlotMatch = fieldDef
                ? GUARDIAN_CONTACT_FIELD_RE.exec(fieldDef.key)
                : null
              const relationshipSlot = nameSlotMatch
                ? Number(nameSlotMatch[1])
                : null

              const mappedCategoryKey = fieldDef
                ? categoryKeyForField(fieldDef)
                : null
              const activeCategoryKey: string | null =
                mappedCategoryKey ?? pendingCategoryByHeader[header] ?? null
              const activeCategory = activeCategoryKey
                ? categories.find((c) => c.key === activeCategoryKey)
                : undefined
              const firstSelectValue = activeCategoryKey ?? mappedValue

              const onFirstSelectChange = (val: string) => {
                const isCategory = categories.some((c) => c.key === val)
                if (isCategory) {
                  setPendingCategoryByHeader((prev) => ({
                    ...prev,
                    [header]: val,
                  }))
                  if (mappedCategoryKey !== val) setMapping(header, SKIP_VALUE)
                  return
                }
                setPendingCategoryByHeader((prev) => {
                  const next = { ...prev }
                  delete next[header]
                  return next
                })
                setMapping(header, val)
              }

              return (
                <TableRow key={header}>
                  <TableCell>
                    <Badge variant="outline">{header}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Combobox
                          value={firstSelectValue}
                          onValueChange={(val) =>
                            onFirstSelectChange(val ?? '')
                          }
                          items={firstSelectItems}
                        >
                          <ComboboxTrigger
                            render={
                              <Button
                                variant="outline"
                                className="w-full max-w-xs justify-between font-normal"
                              >
                                <ComboboxValue />
                              </Button>
                            }
                          />
                          <ComboboxContent>
                            <ComboboxInput
                              showTrigger={false}
                              placeholder={t('common.search', 'Search...')}
                            />
                            <ComboboxEmpty>
                              {t('common.noResultsFound', 'No items found.')}
                            </ComboboxEmpty>
                            <ComboboxList>
                              {(item: { value: string; label: string }) => (
                                <ComboboxItem
                                  key={item.value}
                                  value={item.value}
                                >
                                  {item.label}
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                        {activeCategory && (
                          <Combobox
                            value={
                              mappedCategoryKey === activeCategoryKey
                                ? mappedValue
                                : ''
                            }
                            onValueChange={(val) =>
                              setMapping(header, val ?? '')
                            }
                            items={activeCategory.fields}
                          >
                            <ComboboxTrigger
                              render={
                                <Button
                                  variant="outline"
                                  className="w-full max-w-xs justify-between font-normal"
                                >
                                  <ComboboxValue
                                    placeholder={t(
                                      'csvImport.columnMap.chooseField',
                                      'Choose field…',
                                    )}
                                  />
                                </Button>
                              }
                            />
                            <ComboboxContent>
                              <ComboboxInput
                                showTrigger={false}
                                placeholder={t('common.search', 'Search...')}
                              />
                              <ComboboxEmpty>
                                {t('common.noResultsFound', 'No items found.')}
                              </ComboboxEmpty>
                              <ComboboxList>
                                {(item: { value: string; label: string }) => (
                                  <ComboboxItem
                                    key={item.value}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        )}
                        {fieldDef?.required && (
                          <Badge variant="secondary">
                            {t('csvImport.columnMap.required', 'Required')}
                          </Badge>
                        )}
                        {fieldDef?.group === 'guardian' && (
                          <Badge variant="outline">
                            {t('csvImport.columnMap.guardian', 'Guardian')}
                          </Badge>
                        )}
                        {fieldDef?.group === 'contact' && (
                          <Badge variant="outline">
                            {t('csvImport.columnMap.contact', 'Contact')}
                          </Badge>
                        )}
                        {fieldDef?.group === 'sacrament' && (
                          <Badge variant="outline">
                            {t('csvImport.columnMap.sacrament', 'Sacrament')}
                          </Badge>
                        )}
                      </div>
                      {isDuplicate && (
                        <p className="text-xs text-destructive">
                          {t(
                            'csvImport.columnMap.duplicateError',
                            '"{{field}}" is already mapped from another column',
                            { field: t(fieldDef!.labelKey, fieldDef!.key) },
                          )}
                        </p>
                      )}
                      {relationshipSlot !== null && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground shrink-0">
                            {t(
                              'csvImport.columnMap.relationship',
                              'Relationship',
                            )}
                          </span>
                          <Input
                            className="h-8 max-w-48"
                            placeholder={t(
                              'csvImport.columnMap.relationshipPlaceholder',
                              'e.g. father, mother, guardian',
                            )}
                            value={relationshipBySlot[relationshipSlot] ?? ''}
                            onChange={(e) =>
                              onRelationshipChange(
                                relationshipSlot,
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      )}
                      {contactSlotMatch && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground shrink-0">
                            {t('csvImport.columnMap.contactTypeLabel', 'Type')}
                          </span>
                          <Combobox
                            value={contactTypeByField[fieldDef!.key] ?? 'other'}
                            onValueChange={(val) =>
                              onContactTypeChange(fieldDef!.key, val ?? 'other')
                            }
                            items={CONTACT_TYPE_ITEMS.map((c) => ({
                              value: c.value,
                              label: t(c.labelKey, c.value),
                            }))}
                          >
                            <ComboboxTrigger
                              render={
                                <Button
                                  variant="outline"
                                  className="h-8 w-36 justify-between font-normal"
                                >
                                  <ComboboxValue />
                                </Button>
                              }
                            />
                            <ComboboxContent>
                              <ComboboxInput
                                showTrigger={false}
                                placeholder={t('common.search', 'Search...')}
                              />
                              <ComboboxEmpty>
                                {t('common.noResultsFound', 'No items found.')}
                              </ComboboxEmpty>
                              <ComboboxList>
                                {(item: {
                                  value: ContactType
                                  label: string
                                }) => (
                                  <ComboboxItem
                                    key={item.value}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {!fullNameMapped && (
        <p className="text-sm text-destructive">
          {t(
            'csvImport.columnMap.requiredWarning',
            'Required field "fullName" must be mapped to proceed',
          )}
        </p>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('common.back', 'Back')}
        </Button>
        <Button type="button" disabled={!canProceed} onClick={onNext}>
          {t('common.next', 'Next')}
        </Button>
      </div>
    </div>
  )
}
