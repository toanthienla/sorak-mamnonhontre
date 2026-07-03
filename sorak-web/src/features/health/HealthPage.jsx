import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/shared/components/page-header';
import { HealthAssessmentTab } from './HealthAssessmentTab';
import { NutritionTab } from './NutritionTab';

export function HealthPage() {
  return (
    <>
      <PageHeader
        title="Sức khỏe"
        description="Đánh giá sức khỏe định kỳ và theo dõi dinh dưỡng học sinh"
      />
      <Tabs defaultValue="health" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="health">Đánh giá sức khỏe</TabsTrigger>
          <TabsTrigger value="nutrition">Đánh giá nuôi dưỡng</TabsTrigger>
        </TabsList>
        <TabsContent value="health">
          <HealthAssessmentTab />
        </TabsContent>
        <TabsContent value="nutrition">
          <NutritionTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
