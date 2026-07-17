import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '~/components/ui/accordion'

export function SingleOpen() {
  return (
    <Accordion defaultValue={['tuition']} className="w-[420px]">
      <AccordionItem value="tuition">
        <AccordionTrigger>What is the tuition fee?</AccordionTrigger>
        <AccordionContent>
          Tuition is 500,000 VND per semester, covering textbooks and materials
          for all grade levels.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="schedule">
        <AccordionTrigger>When do classes meet?</AccordionTrigger>
        <AccordionContent>
          Classes meet every Sunday from 8:00 to 10:30 AM, following the parish
          Mass schedule.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="enrollment">
        <AccordionTrigger>How do I enroll my child?</AccordionTrigger>
        <AccordionContent>
          Registration opens each August at the parish office. Bring a copy of
          the baptismal certificate.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function MultipleOpen() {
  return (
    <Accordion
      openMultiple
      defaultValue={['catechists', 'materials']}
      className="w-[420px]"
    >
      <AccordionItem value="catechists">
        <AccordionTrigger>Catechists this year</AccordionTrigger>
        <AccordionContent>
          7 volunteer catechists lead classes across Sơ Cấp 1 through Chuyên Cần
          2.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="materials">
        <AccordionTrigger>Teaching materials</AccordionTrigger>
        <AccordionContent>
          Workbooks are distributed at the first class of each semester.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="events">
        <AccordionTrigger>Upcoming events</AccordionTrigger>
        <AccordionContent>
          First Communion retreat is scheduled for the last Sunday of November.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
