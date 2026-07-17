import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '~/components/ui/alert-dialog'

export function Default() {
  return (
    <AlertDialog defaultOpen modal={false}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete student record?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this student and their attendance
            history. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
