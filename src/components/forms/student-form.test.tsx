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
})
