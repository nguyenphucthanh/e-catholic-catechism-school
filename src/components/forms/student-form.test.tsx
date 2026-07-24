import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import {
  StudentForm,
  buildAddressArgs,
  defaultStudentFormValues,
  hasAddress,
} from './student-form'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('~/components/custom/inputs/phone-input', () => ({
  PhoneInput: ({ value, onChange }: any) => (
    <input
      data-testid="phone-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

function selectOption(placeholderOrLabelText: string, optionName: string) {
  const trigger = screen.getByText(placeholderOrLabelText).closest('button')!
  fireEvent.click(trigger)
  const option = screen.getByRole('option', { name: optionName })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe('student-form helper functions', () => {
  it('returns valid initial default values for student form', () => {
    const defaults = defaultStudentFormValues()

    expect(defaults.fullName).toBe('')
    expect(defaults.isActive).toBe(true)
    expect(defaults.sacraments.baptism.received).toBe(false)
    expect(defaults.guardians).toEqual([])
    expect(defaults.enrollmentEnabled).toBe(false)
  })

  it('hasAddress correctly identifies if any address field is non-empty', () => {
    const emptyValues = defaultStudentFormValues()
    expect(hasAddress(emptyValues)).toBe(false)

    expect(hasAddress({ ...emptyValues, addressLine1: '123 Main St' })).toBe(
      true,
    )
    expect(hasAddress({ ...emptyValues, city: 'Hanoi' })).toBe(true)
    expect(hasAddress({ ...emptyValues, stateProvince: 'Hanoi' })).toBe(true)
    expect(hasAddress({ ...emptyValues, postalCode: '100000' })).toBe(true)
    expect(hasAddress({ ...emptyValues, hamlet: 'Hamlet 1' })).toBe(true)
    expect(hasAddress({ ...emptyValues, subHamlet: 'Sub 2' })).toBe(true)
  })

  it('buildAddressArgs constructs correct payload object', () => {
    const values = defaultStudentFormValues()
    values.addressLine1 = '123 Main St'
    values.city = 'Hanoi'

    const args = buildAddressArgs(values)
    expect(args.addressLine1).toBe('123 Main St')
    expect(args.city).toBe('Hanoi')
    expect(args.addressLine2).toBeUndefined()
    expect(args.country).toBeDefined()
  })
})

describe('StudentForm component', () => {
  const requesterId = 'catechist123' as any

  it('renders form inputs and calls onChange when personal info fields change', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    // Check titles
    expect(screen.getByText('students.form.personal.title')).toBeDefined()
    expect(screen.getByText('students.form.address.title')).toBeDefined()
    expect(screen.getByText('students.form.sacraments.title')).toBeDefined()

    // Edit full name
    const inputs = screen.getAllByRole('textbox')
    // Saint name is inputs[0], Full name is inputs[1]
    fireEvent.change(inputs[1], { target: { value: 'Nguyen Van A' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Nguyen Van A' }),
    )
  })

  it('toggles sacrament received status and updates fields', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()

    const { container } = render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    const baptismCheckbox = container.querySelector('#sacrament-type-baptism')!
    fireEvent.click(baptismCheckbox)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sacraments: expect.objectContaining({
          baptism: expect.objectContaining({ received: true }),
        }),
      }),
    )
  })

  it('shows sacrament details when sacrament is received', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.sacraments.baptism = {
      received: true,
      receivedDate: '2020-01-01',
      receivedPlace: 'Parish A',
      notes: 'Notes A',
    }

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(screen.getByDisplayValue('2020-01-01')).toBeDefined()
    expect(screen.getByDisplayValue('Parish A')).toBeDefined()
    expect(screen.getByDisplayValue('Notes A')).toBeDefined()
  })

  it('allows adding, updating, and removing guardians', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()

    const { rerender } = render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(screen.getByText('students.form.guardian.empty')).toBeDefined()

    // Add guardian
    const addButton = screen.getByText('students.form.guardian.add')
    fireEvent.click(addButton)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [
          expect.objectContaining({
            localId: expect.any(String),
            contactPriority: 1,
            relationship: 'father',
          }),
        ],
      }),
    )

    // Rerender with 1 guardian
    const valuesWithGuardian = {
      ...values,
      guardians: [
        {
          localId: 'g1',
          guardianId: undefined,
          fullName: 'Father Name',
          saintName: 'Joseph',
          relationship: 'father',
          contactPriority: 1,
          notes: 'Test notes',
          phone: '+84900000000',
          email: 'father@test.com',
          isLinked: false,
        },
      ],
    }

    rerender(
      <StudentForm
        mode="create"
        values={valuesWithGuardian}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(screen.getByDisplayValue('Father Name')).toBeDefined()

    // Remove guardian
    const removeButton = screen.getByRole('button', {
      name: 'students.form.guardian.remove',
    })
    fireEvent.click(removeButton)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ guardians: [] }),
    )
  })

  it('renders enrollment section in create mode and handles class selection', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.enrollmentEnabled = true

    vi.mocked(useQuery).mockReturnValue([
      { classYearId: 'cy1', className: 'Class 1A' },
    ] as any)

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(screen.getByText('students.form.enrollment.title')).toBeDefined()
    expect(screen.getByText('students.form.enrollment.enable')).toBeDefined()
  })

  it('hides enrollment section in edit mode', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()

    render(
      <StudentForm
        mode="edit"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(screen.queryByText('students.form.enrollment.title')).toBeNull()
  })

  it('handles guardian phone lookup link and unlink', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.guardians = [
      {
        localId: 'g1',
        guardianId: undefined,
        fullName: '',
        saintName: '',
        relationship: 'father',
        contactPriority: 1,
        notes: '',
        phone: '+84900000000',
        email: '',
        isLinked: false,
      },
    ]

    // Mock query returning existing guardian
    vi.mocked(useQuery).mockImplementation(((...args: Array<any>) => {
      const queryArgs = args[1]
      if (queryArgs && typeof queryArgs === 'object' && 'phone' in queryArgs) {
        return {
          _id: 'existingG1',
          fullName: 'Found Father',
          saintName: 'Giuse',
        }
      }
      return undefined
    }) as any)

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [
          expect.objectContaining({
            guardianId: 'existingG1',
            fullName: 'Found Father',
            isLinked: true,
          }),
        ],
      }),
    )
  })

  it('unlinks guardian when phone is updated or lookup returns not found', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.guardians = [
      {
        localId: 'g1',
        guardianId: 'existingG1',
        fullName: 'Found Father',
        saintName: 'Giuse',
        relationship: 'father',
        contactPriority: 1,
        notes: '',
        phone: '+84900000000',
        email: '',
        isLinked: true,
      },
    ]

    vi.mocked(useQuery).mockReturnValue(null as any)

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [
          expect.objectContaining({
            guardianId: undefined,
            isLinked: false,
          }),
        ],
      }),
    )
  })

  it('handles field changes for all student form inputs and sections', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.enrollmentEnabled = true

    localStorage.setItem('giaoly_selected_year', 'year123')

    vi.mocked(useQuery).mockReturnValue([
      { classYearId: 'cy1', className: 'Class 1A' },
    ] as any)

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    // Edit address inputs via textboxes index 4 for addressLine1
    const textboxes = screen.getAllByRole('textbox')
    // 0: saintName, 1: fullName, 2: prevParish, 3: prevDiocese, 4: line1, 5: line2, 6: city, 7: state, 8: hamlet, 9: subHamlet, 10: postal
    fireEvent.change(textboxes[4], { target: { value: 'Line 1' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ addressLine1: 'Line 1' }),
    )

    fireEvent.change(textboxes[5], { target: { value: 'Line 2' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ addressLine2: 'Line 2' }),
    )

    fireEvent.change(textboxes[6], { target: { value: 'City' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'City' }),
    )

    fireEvent.change(textboxes[7], { target: { value: 'State' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ stateProvince: 'State' }),
    )

    fireEvent.change(textboxes[8], { target: { value: 'Hamlet' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ hamlet: 'Hamlet' }),
    )

    fireEvent.change(textboxes[9], { target: { value: 'SubHamlet' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subHamlet: 'SubHamlet' }),
    )

    fireEvent.change(textboxes[10], { target: { value: '10000' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: '10000' }),
    )

    localStorage.removeItem('giaoly_selected_year')
  })

  it('updates previousParish and previousDiocese fields', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    const textboxes = screen.getAllByRole('textbox')
    // 0: saintName, 1: fullName, 2: previousParish, 3: previousDiocese
    fireEvent.change(textboxes[2], { target: { value: 'Parish X' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ previousParish: 'Parish X' }),
    )

    fireEvent.change(textboxes[3], { target: { value: 'Diocese Y' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ previousDiocese: 'Diocese Y' }),
    )
  })

  it('updates dateOfBirth field', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()

    const { container } = render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2015-05-05' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirth: '2015-05-05' }),
    )
  })

  it('selects gender and active status via Select dropdowns', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    selectOption('students.form.gender.placeholder', 'students.gender.female')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ gender: 'female' }),
    )

    selectOption(
      'students.form.isActive.active',
      'students.form.isActive.inactive',
    )
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    )
  })

  it('updates all guardian entry fields (phone, email, name, relationship, priority, notes)', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.guardians = [
      {
        localId: 'g1',
        guardianId: undefined,
        fullName: 'Old Name',
        saintName: 'Old Saint',
        relationship: 'father',
        contactPriority: 1,
        notes: 'Old notes',
        phone: '',
        email: '',
        isLinked: false,
      },
    ]

    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    // Phone (mocked PhoneInput, always prefixes with +)
    fireEvent.change(screen.getByTestId('phone-input'), {
      target: { value: '84900000001' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [
          expect.objectContaining({
            phone: '+84900000001',
            isLinked: false,
            guardianId: undefined,
          }),
        ],
      }),
    )

    // Email
    const emailInput = document.querySelector('input[type="email"]')!
    fireEvent.change(emailInput, { target: { value: 'g@test.com' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [expect.objectContaining({ email: 'g@test.com' })],
      }),
    )

    // Full name and saint name
    const fullNameInput = screen.getByDisplayValue('Old Name')
    fireEvent.change(fullNameInput, { target: { value: 'New Name' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [expect.objectContaining({ fullName: 'New Name' })],
      }),
    )

    const saintNameInput = screen.getByDisplayValue('Old Saint')
    fireEvent.change(saintNameInput, { target: { value: 'New Saint' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [expect.objectContaining({ saintName: 'New Saint' })],
      }),
    )

    // Relationship select
    selectOption(
      'students.form.guardian.relationship.father',
      'students.form.guardian.relationship.mother',
    )
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [expect.objectContaining({ relationship: 'mother' })],
      }),
    )

    // Contact priority
    const priorityInput = document.querySelector('input[type="number"]')!
    fireEvent.change(priorityInput, { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [expect.objectContaining({ contactPriority: 3 })],
      }),
    )

    // Invalid priority falls back to 1
    fireEvent.change(priorityInput, { target: { value: 'abc' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [expect.objectContaining({ contactPriority: 1 })],
      }),
    )

    // Notes
    const notesInput = screen.getByDisplayValue('Old notes')
    fireEvent.change(notesInput, { target: { value: 'New notes' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [expect.objectContaining({ notes: 'New notes' })],
      }),
    )
  })

  it('updates sacrament receivedDate, receivedPlace, and notes fields', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.sacraments.baptism = {
      received: true,
      receivedDate: '2020-01-01',
      receivedPlace: 'Parish A',
      notes: 'Notes A',
    }

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    const dateInput = screen.getByDisplayValue('2020-01-01')
    fireEvent.change(dateInput, { target: { value: '2021-02-02' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sacraments: expect.objectContaining({
          baptism: expect.objectContaining({ receivedDate: '2021-02-02' }),
        }),
      }),
    )

    const placeInput = screen.getByDisplayValue('Parish A')
    fireEvent.change(placeInput, { target: { value: 'Parish B' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sacraments: expect.objectContaining({
          baptism: expect.objectContaining({ receivedPlace: 'Parish B' }),
        }),
      }),
    )

    const notesInput = screen.getByDisplayValue('Notes A')
    fireEvent.change(notesInput, { target: { value: 'Notes B' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sacraments: expect.objectContaining({
          baptism: expect.objectContaining({ notes: 'Notes B' }),
        }),
      }),
    )
  })

  it('handles enrollment enable toggle, class selection, and date change', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.enrollmentEnabled = true

    localStorage.setItem('giaoly_selected_year', 'year123')

    vi.mocked(useQuery).mockReturnValue([
      { classYearId: 'cy1', className: 'Class 1A' },
    ] as any)

    const { container } = render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    // Toggle enrollment checkbox off
    const enableCheckbox = container.querySelector('#enrollment-enable')!
    fireEvent.click(enableCheckbox)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentEnabled: false }),
    )

    // Class select
    selectOption('students.form.enrollment.class.placeholder', 'Class 1A')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentClassYearId: 'cy1' }),
    )

    // Enrollment date
    const dateInputs = container.querySelectorAll('input[type="date"]')
    const enrollmentDateInput = dateInputs[dateInputs.length - 1]
    fireEvent.change(enrollmentDateInput, {
      target: { value: '2024-09-01' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentDate: '2024-09-01' }),
    )

    localStorage.removeItem('giaoly_selected_year')
  })

  it('shows "no classes" message when class year query returns an empty list', () => {
    const onChange = vi.fn()
    const values = defaultStudentFormValues()
    values.enrollmentEnabled = true

    localStorage.setItem('giaoly_selected_year', 'year123')
    vi.mocked(useQuery).mockReturnValue([] as any)

    render(
      <StudentForm
        mode="create"
        values={values}
        onChange={onChange}
        requesterId={requesterId}
      />,
    )

    expect(
      screen.getByText('students.form.enrollment.noClasses'),
    ).toBeInTheDocument()

    localStorage.removeItem('giaoly_selected_year')
  })
})
