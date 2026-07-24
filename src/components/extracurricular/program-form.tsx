import { useTranslation } from 'react-i18next'
import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { Plus, Trash2 } from 'lucide-react'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { ProgramLink } from './program-links-list'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { RichTextEditor } from '~/components/custom/richtext-editor'

interface ProgramFormProps {
  branches: Array<Doc<'branches'>>
  onSubmit: (data: {
    title: string
    details: string
    target: 'catechist' | 'student' | 'all'
    branches: Array<Id<'branches'>>
    dateStart: string
    dateEnd: string
    enrollmentExpireDate: string
    feeRequired: boolean
    feeAmount?: number
    maxCapacity?: number
    links: Array<ProgramLink>
  }) => Promise<void>
  initialData?: {
    title: string
    details: string
    target: 'catechist' | 'student' | 'all'
    branches: Array<Id<'branches'>>
    dateStart: string
    dateEnd: string
    enrollmentExpireDate: string
    feeRequired: boolean
    feeAmount?: number
    maxCapacity?: number
    links?: Array<ProgramLink>
  }
}

export function ExtracurricularProgramForm({
  branches,
  onSubmit,
  initialData,
}: ProgramFormProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const defaultValues = {
    title: initialData?.title ?? '',
    details: initialData?.details ?? '{"type":"doc","content":[]}',
    target: initialData?.target ?? 'all',
    branches: initialData?.branches ?? [],
    dateStart: initialData?.dateStart ?? new Date().toISOString().split('T')[0],
    dateEnd: initialData?.dateEnd ?? new Date().toISOString().split('T')[0],
    enrollmentExpireDate:
      initialData?.enrollmentExpireDate ??
      new Date().toISOString().split('T')[0],
    feeRequired: initialData?.feeRequired ?? false,
    feeAmount: initialData?.feeAmount,
    maxCapacity: initialData?.maxCapacity,
    links: initialData?.links ?? ([] as Array<ProgramLink>),
  }

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)
      try {
        await onSubmit({
          title: value.title,
          details: value.details,
          target: value.target,
          branches: value.branches,
          dateStart: value.dateStart,
          dateEnd: value.dateEnd,
          enrollmentExpireDate: value.enrollmentExpireDate,
          feeRequired: value.feeRequired,
          feeAmount: value.feeAmount,
          maxCapacity: value.maxCapacity,
          links: value.links,
        })
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      {/* Program Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('extracurricular.sections.info')}</CardTitle>
          <CardDescription>
            {t('extracurricular.sections.infoDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field
            name="title"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor="title">{t('extracurricular.title')}</Label>
                <Input
                  id="title"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          />

          <form.Field
            name="details"
            children={(field) => (
              <div className="space-y-2">
                <Label>{t('extracurricular.details')}</Label>
                <RichTextEditor
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value)}
                  placeholder={t('extracurricular.detailsPlaceholder')}
                  mode="advance"
                />
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Target & Scope */}
      <Card>
        <CardHeader>
          <CardTitle>{t('extracurricular.sections.scope')}</CardTitle>
          <CardDescription>
            {t('extracurricular.sections.scopeDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field
            name="target"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor="target">{t('extracurricular.target')}</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(value as 'catechist' | 'student' | 'all')
                  }
                  items={[
                    {
                      value: 'catechist',
                      label: t('extracurricular.target.catechist'),
                    },
                    {
                      value: 'student',
                      label: t('extracurricular.target.student'),
                    },
                    {
                      value: 'all',
                      label: t('extracurricular.target.all'),
                    },
                  ]}
                >
                  <SelectTrigger id="target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="catechist">
                      {t('extracurricular.target.catechist')}
                    </SelectItem>
                    <SelectItem value="student">
                      {t('extracurricular.target.student')}
                    </SelectItem>
                    <SelectItem value="all">
                      {t('extracurricular.target.all')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          />

          <form.Field
            name="branches"
            children={(field) => (
              <div className="space-y-2">
                <Label>{t('extracurricular.branches')}</Label>
                <div className="space-y-2">
                  {branches.map((branch) => (
                    <div
                      key={branch._id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`branch-${branch._id}`}
                        checked={field.state.value.includes(branch._id)}
                        onCheckedChange={(checked) => {
                          const newBranches = checked
                            ? [...field.state.value, branch._id]
                            : field.state.value.filter(
                                (b: Id<'branches'>) => b !== branch._id,
                              )
                          field.handleChange(newBranches)
                        }}
                      />
                      <label
                        htmlFor={`branch-${branch._id}`}
                        className="text-sm cursor-pointer"
                      >
                        {branch.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Dates & Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle>{t('extracurricular.sections.dates')}</CardTitle>
          <CardDescription>
            {t('extracurricular.sections.datesDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="dateStart"
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor="dateStart">
                    {t('extracurricular.dateStart')}
                  </Label>
                  <Input
                    id="dateStart"
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            />

            <form.Field
              name="dateEnd"
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor="dateEnd">
                    {t('extracurricular.dateEnd')}
                  </Label>
                  <Input
                    id="dateEnd"
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            />
          </div>

          <form.Field
            name="enrollmentExpireDate"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor="enrollmentExpireDate">
                  {t('extracurricular.enrollmentExpireDate')}
                </Label>
                <Input
                  id="enrollmentExpireDate"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Fees & Capacity */}
      <Card>
        <CardHeader>
          <CardTitle>{t('extracurricular.sections.fees')}</CardTitle>
          <CardDescription>
            {t('extracurricular.sections.feesDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field
            name="feeRequired"
            children={(field) => (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="feeRequired"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                  />
                  <Label htmlFor="feeRequired" className="cursor-pointer">
                    {t('extracurricular.feeRequired')}
                  </Label>
                </div>

                {field.state.value && (
                  <form.Field
                    name="feeAmount"
                    children={(amountField) => (
                      <div className="space-y-2">
                        <Label htmlFor="feeAmount">
                          {t('extracurricular.feeAmount')}
                        </Label>
                        <Input
                          id="feeAmount"
                          type="number"
                          step="0.01"
                          value={amountField.state.value ?? ''}
                          onChange={(e) =>
                            amountField.handleChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            )
                          }
                          onBlur={amountField.handleBlur}
                        />
                      </div>
                    )}
                  />
                )}
              </>
            )}
          />

          <form.Field
            name="maxCapacity"
            children={(field) => (
              <div className="space-y-2">
                <Label htmlFor="maxCapacity">
                  {t('extracurricular.maxCapacity')}
                </Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  value={field.state.value ?? ''}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value ? parseInt(e.target.value, 10) : undefined,
                    )
                  }
                  onBlur={field.handleBlur}
                  placeholder={t('extracurricular.maxCapacityPlaceholder')}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('extracurricular.sections.links')}</CardTitle>
          <CardDescription>
            {t('extracurricular.sections.linksDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field
            name="links"
            children={(field) => (
              <div className="space-y-4">
                {field.state.value.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('extracurricular.noLinksYet')}
                  </p>
                )}
                {field.state.value.map((link, index) => (
                  <div key={index} className="space-y-3 rounded-lg border p-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`link-type-${index}`}>
                          {t('extracurricular.linkType')}
                        </Label>
                        <Select
                          value={link.type}
                          onValueChange={(value) => {
                            const next = [...field.state.value]
                            next[index] = {
                              ...next[index],
                              type: value as 'social' | 'im',
                            }
                            field.handleChange(next)
                          }}
                          items={[
                            {
                              value: 'social',
                              label: t('extracurricular.linkType.social'),
                            },
                            {
                              value: 'im',
                              label: t('extracurricular.linkType.im'),
                            },
                          ]}
                        >
                          <SelectTrigger id={`link-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="social">
                              {t('extracurricular.linkType.social')}
                            </SelectItem>
                            <SelectItem value="im">
                              {t('extracurricular.linkType.im')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`link-label-${index}`}>
                          {t('extracurricular.linkLabel')}
                        </Label>
                        <Input
                          id={`link-label-${index}`}
                          aria-label={t('extracurricular.linkLabel')}
                          value={link.label}
                          onChange={(e) => {
                            const next = [...field.state.value]
                            next[index] = {
                              ...next[index],
                              label: e.target.value,
                            }
                            field.handleChange(next)
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`link-url-${index}`}>
                        {t('extracurricular.linkUrl')}
                      </Label>
                      <Input
                        id={`link-url-${index}`}
                        aria-label={t('extracurricular.linkUrl')}
                        value={link.url}
                        onChange={(e) => {
                          const next = [...field.state.value]
                          next[index] = { ...next[index], url: e.target.value }
                          field.handleChange(next)
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          aria-label={t('extracurricular.forEnrolledOnly')}
                          checked={link.forEnrolledOnly}
                          onCheckedChange={(checked) => {
                            const next = [...field.state.value]
                            next[index] = {
                              ...next[index],
                              forEnrolledOnly: checked,
                            }
                            field.handleChange(next)
                          }}
                        />
                        <span className="text-sm">
                          {t('extracurricular.forEnrolledOnly')}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('extracurricular.removeLink')}
                        onClick={() =>
                          field.handleChange(
                            field.state.value.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    field.handleChange([
                      ...field.state.value,
                      {
                        type: 'social',
                        label: '',
                        url: '',
                        forEnrolledOnly: false,
                      },
                    ])
                  }
                >
                  <Plus className="mr-1 size-4" />
                  {t('extracurricular.addLink')}
                </Button>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t('common.saving') : t('common.save')}
      </Button>
    </form>
  )
}
