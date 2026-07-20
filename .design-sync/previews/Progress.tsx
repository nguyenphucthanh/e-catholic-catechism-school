import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '~/components/ui/progress'

export function Default() {
  return (
    <div className="w-72">
      <Progress value={62}>
        <ProgressLabel>Course completion</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}

export function ValueSweep() {
  return (
    <div className="flex w-72 flex-col gap-4">
      <Progress value={15}>
        <ProgressLabel>Sơ Cấp 1 attendance</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={54}>
        <ProgressLabel>Chuyên Cần 2 attendance</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={100}>
        <ProgressLabel>Vào Đời 1 attendance</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}
