import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../shared/stores/auth.store';
import { cn } from '../../shared/lib/utils';
import { YearSelector } from '../../shared/components/year-selector';
import { AcademicYearsModal } from '../../features/academic-years/AcademicYearsModal';
import {
  LayoutDashboard,
  Users,
  School,
  UserCog,
  GraduationCap,
  LogOut,
  Settings2,
  Menu,
  X,
  KeyRound,
  ChevronUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/shared/api/client';
import { toast } from 'sonner';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Tài khoản', icon: UserCog, roles: ['BGH'] },
  { to: '/teachers', label: 'Cán bộ', icon: GraduationCap, roles: ['BGH'] },
  { to: '/classes', label: 'Lớp học', icon: School },
  { to: '/students', label: 'Học sinh', icon: Users },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const roleLabel =
    user?.role === 'BGH' ? 'Ban Giám Hiệu'
      : user?.role === 'GV' ? 'Giáo viên'
        : user?.role === 'PH' ? 'Phụ huynh'
          : '';

  const submitChangePw = async (e) => {
    e.preventDefault();
    if (!oldPw || newPw.length < 6) return;
    setPwSubmitting(true);
    try {
      await apiClient.post('/auth/change-password', { old_password: oldPw, new_password: newPw });
      toast.success('Đổi mật khẩu thành công');
      setPwOpen(false); setOldPw(''); setNewPw('');
    } catch { /* toast */ } finally { setPwSubmitting(false); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex overflow-hidden bg-muted/30">
      {/* mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'w-60 bg-card border-r flex flex-col h-full shrink-0 z-40',
          'fixed inset-y-0 left-0 transform transition-transform md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Sorak" className="h-10 w-10 object-contain shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-base font-extrabold leading-tight" style={{ color: '#1A2845' }}>Sorak</div>
              <div className="text-[11px] text-gray-900 font-normal leading-tight">Trường Mầm non Hòn Tre</div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-md hover:bg-accent"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav
            .filter((n) => !n.roles || n.roles.includes(user?.role))
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent',
                  )
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
        </nav>

        <div className="p-3 space-y-3 border-t">
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <YearSelector />
            </div>
            {user?.role === 'BGH' && (
              <button
                title="Quản lý năm học"
                onClick={() => setYearModalOpen(true)}
                className="shrink-0 p-2 rounded-md text-muted-foreground hover:bg-accent transition"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition text-left">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {user?.gender === 'Nữ' ? 'Cô ' : user?.gender === 'Nam' ? 'Thầy ' : ''}
                    {user?.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground">{roleLabel}</div>
                </div>
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
              <DropdownMenuItem onClick={() => setPwOpen(true)}>
                <KeyRound className="h-4 w-4 mr-2 opacity-60" /> Đổi mật khẩu
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b bg-card shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-accent"
            title="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo.png" alt="Sorak" className="h-7 w-7 object-contain" />
          <span className="font-extrabold" style={{ color: '#1A2845' }}>Sorak</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <AcademicYearsModal open={yearModalOpen} onOpenChange={setYearModalOpen} />

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Đổi mật khẩu</DialogTitle></DialogHeader>
          <form onSubmit={submitChangePw} className="space-y-3">
            <div>
              <Label>Mật khẩu cũ <span className="text-destructive">*</span></Label>
              <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Mật khẩu mới <span className="text-destructive">*</span></Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Tối thiểu 6 ký tự.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={pwSubmitting || !oldPw || newPw.length < 6}>
                {pwSubmitting ? 'Đang đổi...' : 'Cập nhật'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
