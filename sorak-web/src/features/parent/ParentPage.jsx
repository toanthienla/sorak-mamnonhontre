import { useAuthStore } from '@/shared/stores/auth.store';
import { cloudinaryThumb } from '@/shared/utils/image';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

export function ParentPage() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const { data: student, isLoading } = useQuery({
    queryKey: ['parent-me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data?.data ?? res.data;
    },
  });

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      /* ignore */
    }
    logout();
    toast.success('Đã đăng xuất');
    navigate('/login', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  const sc = student?.enrollments?.[0];
  const parents = student?.parents ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/sorak-logo.png" alt="Sorak" className="h-8 w-8 object-contain" />
            <div>
              <div className="text-sm font-bold leading-tight text-gray-900">Sorak</div>
              <div className="text-xs text-muted-foreground leading-tight">
                Trường Mầm non Hòn Tre
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {/* Student card */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <div className="flex items-center gap-4">
            {student?.photo_url ? (
              <img
                src={cloudinaryThumb(student.photo_url, 128)}
                alt=""
                className="w-16 h-16 rounded-xl object-cover shrink-0 border"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-2xl font-bold text-gray-400">
                {student?.full_name?.split(' ').slice(-1)[0]?.[0] ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-lg font-bold text-gray-900 truncate">{student?.full_name}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {student?.student_id_card_number}
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Thông tin học sinh
            </span>
          </div>
          <div className="px-5 py-1">
            <InfoRow label="Lớp" value={sc?.class?.class_name} />
            <InfoRow label="Năm học" value={sc?.class?.school_year?.name} />
            <InfoRow label="Trạng thái" value={student?.student_status} />
            <InfoRow
              label="Ngày sinh"
              value={
                student?.date_of_birth
                  ? new Date(student.date_of_birth).toLocaleDateString('vi-VN')
                  : null
              }
            />
            <InfoRow label="Giới tính" value={student?.gender} />
            <InfoRow label="Khối" value={student?.grade_level} />
            <InfoRow label="Dân tộc" value={student?.ethnicity} />
            <InfoRow label="Quốc tịch" value={student?.nationality} />
            <InfoRow label="Nhóm máu" value={student?.blood_type} />
            <InfoRow label="Nơi sinh" value={student?.birth_place} />
            <InfoRow label="Địa chỉ" value={student?.current_address} />
          </div>
        </div>

        {/* Parents */}
        {parents.length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Phụ huynh
              </span>
            </div>
            <div className="px-5 py-1">
              {parents.map((p, i) => (
                <div key={i} className={`py-3 ${i < parents.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.full_name}</span>
                    <span className="text-xs text-muted-foreground">{p.relationship}</span>
                  </div>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="text-sm text-blue-600 mt-0.5 block">
                      {p.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-1">
          Trường Mầm non Hòn Tre · Powered by Sorak
        </p>
      </div>
    </div>
  );
}
