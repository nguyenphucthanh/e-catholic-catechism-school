import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Check, Upload as UploadIcon } from 'lucide-react'
import type { Id } from '../../../../../convex/_generated/dataModel'
import type { ContactType } from '~/components/csv-import/csvFieldDefinitions'
import type {
  ImportConfig,
  ValidatedRow,
} from '~/components/csv-import/useImportParser'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { cn } from '~/lib/utils'
import { ImportStep1Upload } from '~/components/csv-import/ImportStep1Upload'
import { ImportStep2Config } from '~/components/csv-import/ImportStep2Config'
import { ImportStep3ColumnMap } from '~/components/csv-import/ImportStep3ColumnMap'
import { ImportStep4Preview } from '~/components/csv-import/ImportStep4Preview'
import { ImportStep5Confirm } from '~/components/csv-import/ImportStep5Confirm'
import { ImportStep6Import } from '~/components/csv-import/ImportStep6Import'
import { ImportStep7Result } from '~/components/csv-import/ImportStep7Result'

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/import',
)({
  component: ImportWizardPage,
  staticData: {
    crumbs: [{ label: 'nav.admin.import' }],
  },
})

export type ImportRowResult =
  | { index: number; status: 'ok'; id: string }
  | { index: number; status: 'error'; error: string }

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type WizardState = {
  step: WizardStep
  file: File | null
  rawText: string
  csvHeaders: Array<string>
  config: ImportConfig
  columnMapping: Record<string, string | null>
  relationshipBySlot: Record<number, string>
  contactTypeByField: Record<string, ContactType>
  validatedRows: Array<ValidatedRow>
  importResults: Array<ImportRowResult>
}

type WizardAction =
  | { type: 'SET_FILE'; file: File; rawText: string }
  | { type: 'SET_CONFIG'; config: ImportConfig }
  | { type: 'SET_HEADERS'; headers: Array<string> }
  | { type: 'SET_COLUMN_MAPPING'; mapping: Record<string, string | null> }
  | { type: 'SET_RELATIONSHIP'; slot: number; value: string }
  | { type: 'SET_CONTACT_TYPE'; fieldKey: string; contactType: ContactType }
  | { type: 'SET_VALIDATED_ROWS'; rows: Array<ValidatedRow> }
  | { type: 'SET_IMPORT_RESULTS'; results: Array<ImportRowResult> }
  | { type: 'GO_TO_STEP'; step: WizardStep }
  | { type: 'RESET' }

const initialState: WizardState = {
  step: 1,
  file: null,
  rawText: '',
  csvHeaders: [],
  config: { target: 'students', delimiter: ',', dateFormat: 'yyyy-MM-dd' },
  columnMapping: {},
  relationshipBySlot: {},
  contactTypeByField: {},
  validatedRows: [],
  importResults: [],
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_FILE':
      return { ...state, file: action.file, rawText: action.rawText }
    case 'SET_CONFIG':
      return { ...state, config: action.config }
    case 'SET_HEADERS':
      return { ...state, csvHeaders: action.headers }
    case 'SET_COLUMN_MAPPING':
      return { ...state, columnMapping: action.mapping }
    case 'SET_RELATIONSHIP':
      return {
        ...state,
        relationshipBySlot: {
          ...state.relationshipBySlot,
          [action.slot]: action.value,
        },
      }
    case 'SET_CONTACT_TYPE':
      return {
        ...state,
        contactTypeByField: {
          ...state.contactTypeByField,
          [action.fieldKey]: action.contactType,
        },
      }
    case 'SET_VALIDATED_ROWS':
      return { ...state, validatedRows: action.rows }
    case 'SET_IMPORT_RESULTS':
      return { ...state, importResults: action.results }
    case 'GO_TO_STEP':
      return { ...state, step: action.step }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

function ImportWizardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const [state, dispatch] = React.useReducer(wizardReducer, initialState)

  const steps: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: t('csvImport.steps.upload', 'Upload File') },
    { step: 2, label: t('csvImport.steps.config', 'Configuration') },
    { step: 3, label: t('csvImport.steps.columnMap', 'Map Columns') },
    { step: 4, label: t('csvImport.steps.preview', 'Preview & Validate') },
    { step: 5, label: t('csvImport.steps.confirm', 'Confirm Import') },
    { step: 6, label: t('csvImport.steps.importing', 'Importing…') },
    { step: 7, label: t('csvImport.steps.result', 'Import Result') },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={UploadIcon}
        title={t('csvImport.title', 'Import from CSV')}
      />

      <WizardStepper currentStep={state.step} steps={steps} />

      <div className="bg-card border rounded-xl p-6">
        {state.step === 1 && (
          <ImportStep1Upload
            file={state.file}
            rawText={state.rawText}
            onFileAccepted={(file, rawText) =>
              dispatch({ type: 'SET_FILE', file, rawText })
            }
            onNext={() => dispatch({ type: 'GO_TO_STEP', step: 2 })}
          />
        )}

        {state.step === 2 && (
          <ImportStep2Config
            config={state.config}
            rawText={state.rawText}
            onConfigChange={(config) =>
              dispatch({ type: 'SET_CONFIG', config })
            }
            onHeadersParsed={(headers) =>
              dispatch({ type: 'SET_HEADERS', headers })
            }
            onNext={() => dispatch({ type: 'GO_TO_STEP', step: 3 })}
            onBack={() => dispatch({ type: 'GO_TO_STEP', step: 1 })}
          />
        )}

        {state.step === 3 && (
          <ImportStep3ColumnMap
            csvHeaders={state.csvHeaders}
            target={state.config.target}
            columnMapping={state.columnMapping}
            onMappingChange={(mapping) =>
              dispatch({ type: 'SET_COLUMN_MAPPING', mapping })
            }
            relationshipBySlot={state.relationshipBySlot}
            onRelationshipChange={(slot, value) =>
              dispatch({ type: 'SET_RELATIONSHIP', slot, value })
            }
            contactTypeByField={state.contactTypeByField}
            onContactTypeChange={(fieldKey, contactType) =>
              dispatch({ type: 'SET_CONTACT_TYPE', fieldKey, contactType })
            }
            onNext={() => dispatch({ type: 'GO_TO_STEP', step: 4 })}
            onBack={() => dispatch({ type: 'GO_TO_STEP', step: 2 })}
          />
        )}

        {state.step === 4 &&
          (requesterId ? (
            <ImportStep4Preview
              rawText={state.rawText}
              config={state.config}
              columnMapping={state.columnMapping}
              contactTypeByField={state.contactTypeByField}
              requesterId={requesterId}
              onValidatedRows={(rows) =>
                dispatch({ type: 'SET_VALIDATED_ROWS', rows })
              }
              onNext={() => dispatch({ type: 'GO_TO_STEP', step: 5 })}
              onBack={() => dispatch({ type: 'GO_TO_STEP', step: 3 })}
            />
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {t('common.loading', 'Loading…')}
            </div>
          ))}

        {state.step === 5 && (
          <ImportStep5Confirm
            validatedRows={state.validatedRows}
            target={state.config.target}
            onBack={() => dispatch({ type: 'GO_TO_STEP', step: 4 })}
            onStartImport={() => dispatch({ type: 'GO_TO_STEP', step: 6 })}
          />
        )}

        {state.step === 6 &&
          (requesterId ? (
            <ImportStep6Import
              validatedRows={state.validatedRows}
              target={state.config.target}
              relationshipBySlot={state.relationshipBySlot}
              contactTypeByField={state.contactTypeByField}
              requesterId={requesterId}
              onComplete={(results) => {
                dispatch({ type: 'SET_IMPORT_RESULTS', results })
                dispatch({ type: 'GO_TO_STEP', step: 7 })
              }}
            />
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {t('common.loading', 'Loading…')}
            </div>
          ))}

        {state.step === 7 && (
          <ImportStep7Result
            importResults={state.importResults}
            validatedRows={state.validatedRows}
            target={state.config.target}
            onImportMore={() => dispatch({ type: 'RESET' })}
            onDone={() =>
              void navigate({
                to:
                  state.config.target === 'students'
                    ? '/students'
                    : '/catechists',
              })
            }
          />
        )}
      </div>
    </div>
  )
}

function WizardStepper({
  currentStep,
  steps,
}: {
  currentStep: WizardStep
  steps: Array<{ step: WizardStep; label: string }>
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((s, i) => (
        <React.Fragment key={s.step}>
          {i > 0 && <Separator className="w-6! shrink-0" />}
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={
                s.step === currentStep
                  ? 'default'
                  : s.step < currentStep
                    ? 'secondary'
                    : 'outline'
              }
              className="size-6 rounded-full p-0 justify-center"
            >
              {s.step < currentStep ? <Check className="size-3" /> : s.step}
            </Badge>
            <span
              className={cn(
                'text-sm whitespace-nowrap',
                s.step === currentStep
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}
