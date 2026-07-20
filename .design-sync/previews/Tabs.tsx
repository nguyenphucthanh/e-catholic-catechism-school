import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs'

export function StudentProfile() {
  return (
    <Tabs defaultValue="overview" className="w-[420px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="grades">Grades</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-1 p-2">
        <p className="font-medium">Nguyễn Văn An</p>
        <p className="text-muted-foreground">
          Class: Sơ Cấp 1 · Enrolled since Sep 2024
        </p>
      </TabsContent>
      <TabsContent value="attendance" className="space-y-1 p-2">
        <p className="font-medium">92% attendance this term</p>
        <p className="text-muted-foreground">3 absences, 1 excused</p>
      </TabsContent>
      <TabsContent value="grades" className="space-y-1 p-2">
        <p className="font-medium">Kinh Thánh: 9.0 · Giáo Lý: 8.5</p>
        <p className="text-muted-foreground">Ranked 2nd in class</p>
      </TabsContent>
    </Tabs>
  )
}

export function LineVariant() {
  return (
    <Tabs defaultValue="classes" className="w-[420px]">
      <TabsList variant="line">
        <TabsTrigger value="classes">Classes</TabsTrigger>
        <TabsTrigger value="teachers">Teachers</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="classes" className="p-2">
        Sơ Cấp 1, Sơ Cấp 2, Chuyên Cần 1
      </TabsContent>
      <TabsContent value="teachers" className="p-2">
        7 catechists assigned this year
      </TabsContent>
      <TabsContent value="reports" className="p-2">
        End-of-term reports due Dec 15
      </TabsContent>
    </Tabs>
  )
}
