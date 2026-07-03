import { useState, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../shared/stores/auth.store';
import { apiClient } from '../../shared/api/client';
import { toast } from 'sonner';

const BGH_ONLY = ['/accounts'];
const NAVY = '#1a2845';
const AMBER = '#f5a623';

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none transition-all ' +
  'focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white placeholder:text-gray-400';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4a5070' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, name, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        type={show ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={inputCls + ' pr-11'}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/';

  const [tab, setTab] = useState('parent');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [card, setCard] = useState('');
  const [parentPwd, setParentPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finish = (payload) => {
    setAuth(payload.user);
    toast.success('Đăng nhập thành công');
    const role = payload.user.role;
    if (role === 'PARENT') return navigate('/portal', { replace: true });
    const destination = BGH_ONLY.includes(from) && role !== 'PRINCIPAL' ? '/' : from;
    navigate(destination, { replace: true });
  };

  const loginStaff = async (e) => {
    e.preventDefault();
    if (!email.trim() || !pwd) return;
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email: email.trim(), password: pwd });
      finish(data?.data ?? data);
    } catch {
      /* toast handled */
    } finally {
      setSubmitting(false);
    }
  };

  const loginParent = async (e) => {
    e.preventDefault();
    if (!card.trim() || !parentPwd) return;
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/auth/parent-login', {
        student_id_card_number: card.trim(),
        password: parentPwd,
      });
      finish(data?.data ?? data);
    } catch {
      /* toast handled */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Tab switcher */}
      <div
        className="flex gap-0 mb-7 rounded-xl overflow-hidden border"
        style={{ borderColor: '#eee8dc' }}
      >
        {[
          { key: 'parent', label: 'Phụ huynh' },
          { key: 'staff', label: 'Cán bộ' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex-1 py-2.5 text-sm font-semibold transition-all"
            style={
              tab === key
                ? { background: NAVY, color: '#fff' }
                : { background: '#faf9f7', color: '#7a7e92' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Staff form */}
      {tab === 'staff' && (
        <form onSubmit={loginStaff} className="space-y-5" autoComplete="on">
          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              name="staff-email"
              autoComplete="email"
              placeholder="ten@truong.edu.vn"
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="Mật khẩu">
            <PasswordInput
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              name="staff-password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-medium hover:underline"
              style={{ color: NAVY }}
            >
              Quên mật khẩu?
            </Link>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 mt-1"
            style={{ background: NAVY, color: '#fff', boxShadow: '0 2px 12px rgba(26,40,69,0.18)' }}
          >
            {submitting ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>
      )}

      {/* Parent form */}
      {tab === 'parent' && (
        <form onSubmit={loginParent} className="space-y-5" autoComplete="on">
          <Field label="Mã thẻ học sinh">
            <input
              value={card}
              onChange={(e) => setCard(e.target.value)}
              name="parent-card"
              autoComplete="username"
              placeholder="vd: NBA2024.001"
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="Mật khẩu">
            <PasswordInput
              value={parentPwd}
              onChange={(e) => setParentPwd(e.target.value)}
              name="parent-password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{
              background: AMBER,
              color: '#fff',
              boxShadow: '0 2px 12px rgba(245,166,35,0.28)',
            }}
          >
            {submitting ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
          <p className="text-center text-xs" style={{ color: '#7a7e92' }}>
            Quên mật khẩu? Liên hệ giáo viên chủ nhiệm để đặt lại.
          </p>
        </form>
      )}
    </div>
  );
}
