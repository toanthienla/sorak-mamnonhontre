import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/shared/components/page-header';
import { ClassTransferTab } from './ClassTransferTab';
import { SchoolTransferTab } from './SchoolTransferTab';

export function TransfersPage() {
  return (
    <>
      <PageHeader
        title="Chuyển lớp / Chuyển trường"
        description="Quản lý yêu cầu chuyển lớp và hồ sơ chuyển trường"
      />
      <Tabs defaultValue="class" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="class">Chuyển lớp</TabsTrigger>
          <TabsTrigger value="outgoing">Chuyển đi</TabsTrigger>
          <TabsTrigger value="incoming">Chuyển đến</TabsTrigger>
        </TabsList>
        <TabsContent value="class">
          <ClassTransferTab />
        </TabsContent>
        <TabsContent value="outgoing">
          <SchoolTransferTab direction="outgoing" />
        </TabsContent>
        <TabsContent value="incoming">
          <SchoolTransferTab direction="incoming" />
        </TabsContent>
      </Tabs>
    </>
  );
}
