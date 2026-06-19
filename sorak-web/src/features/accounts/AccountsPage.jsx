import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/shared/components/page-header';
import { useColumnSettings } from '@/shared/hooks/use-column-settings';
import { useAuthStore } from '@/shared/stores/auth.store';
import { STAFF_COLS, STUDENT_ACC_COLS } from './accounts-shared';
import { StaffTab } from './StaffTab';
import { StudentTab } from './StudentTab';

export function AccountsPage() {
  const userRole = useAuthStore((s) => s.user?.role);
  const isBGH = userRole === 'PRINCIPAL';
  const [tab, setTab] = useState('staff');

  // Column settings lifted up so each tab persists independently
  const {
    hidden: staffHidden,
    setHidden: setStaffHidden,
    order: staffOrder,
    setOrder: setStaffOrder,
  } = useColumnSettings(
    'accounts-staff',
    STAFF_COLS.map((c) => c.key),
  );
  const {
    hidden: stuHidden,
    setHidden: setStuHidden,
    order: stuOrder,
    setOrder: setStuOrder,
  } = useColumnSettings(
    'accounts-student',
    STUDENT_ACC_COLS.map((c) => c.key),
  );

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Phân quyền, cấp mật khẩu, khóa/mở khóa tài khoản. Chỉnh sửa hồ sơ ở trang Cán bộ / Học sinh."
      />
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="staff">Tài khoản cán bộ</TabsTrigger>
          <TabsTrigger value="student">Tài khoản học sinh</TabsTrigger>
        </TabsList>
        <TabsContent value="staff">
          <StaffTab
            isBGH={isBGH}
            hidden={staffHidden}
            order={staffOrder}
            setHidden={setStaffHidden}
            setOrder={setStaffOrder}
          />
        </TabsContent>
        <TabsContent value="student">
          <StudentTab
            isBGH={isBGH}
            hidden={stuHidden}
            order={stuOrder}
            setHidden={setStuHidden}
            setOrder={setStuOrder}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
