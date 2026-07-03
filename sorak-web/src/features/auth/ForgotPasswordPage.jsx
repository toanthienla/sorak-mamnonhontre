import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../../shared/api/client';
import { toast } from 'sonner';

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

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        type={show ? 'text' : 'password'}
        placeholder={placeholder ?? '••••••••'}
        autoComplete={autoComplete ?? 'new-password'}
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

export function ForgotPasswordPage() {
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const requestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      toast.success('Đã gửi OTP qua email (nếu tồn tại)');
      setStep('reset');
    } catch {
      /* toast */
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (otp.length !== 6 || newPw.length < 6) return;
    setSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPw,
      });
      toast.success('Đặt lại mật khẩu thành công. Đăng nhập lại.');
      navigate('/login', { replace: true });
    } catch {
      /* toast */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Logo — hiển thị trên mobile */}
      <div className="flex flex-col items-center mb-8 lg:hidden">
        <img src="/sorak-logo.png" alt="Sorak" className="h-12 w-12 object-contain mb-2" />
        <span className="text-2xl font-black" style={{ color: NAVY }}>
          Sorak<span style={{ color: AMBER }}>.</span>
        </span>
      </div>

      {step === 'email' ? (
        <>
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: NAVY }}>
            Quên mật khẩu
          </h2>
          <p className="text-sm mb-8" style={{ color: '#7a7e92' }}>
            Nhập email tài khoản — chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.
          </p>
          <form onSubmit={requestOtp} className="space-y-5">
            <Field label="Email tài khoản">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="ten@truong.edu.vn"
                className={inputCls}
                autoFocus
              />
              <p className="text-xs" style={{ color: '#7a7e92' }}>
                Chỉ dành cho BGH / Giáo viên.
              </p>
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              style={{
                background: NAVY,
                color: '#fff',
                boxShadow: '0 2px 12px rgba(26,40,69,0.18)',
              }}
            >
              {submitting ? 'Đang gửi...' : 'Gửi mã OTP'}
            </button>
            <div className="text-center">
              <Link
                to="/login"
                className="text-xs font-medium hover:underline"
                style={{ color: NAVY }}
              >
                ← Quay lại đăng nhập
              </Link>
            </div>
          </form>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: NAVY }}>
            Đặt lại mật khẩu
          </h2>
          <p className="text-sm mb-8" style={{ color: '#7a7e92' }}>
            Mã OTP đã gửi tới{' '}
            <span className="font-semibold" style={{ color: NAVY }}>
              {email}
            </span>
            . Hiệu lực <strong>10 phút</strong>.
          </p>
          <form onSubmit={submitReset} className="space-y-5">
            <Field label="Mã OTP (6 chữ số)">
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="_ _ _ _ _ _"
                autoComplete="off"
                className={inputCls + ' tracking-[0.4em] text-center text-lg font-bold'}
                autoFocus
              />
            </Field>
            <Field label="Mật khẩu mới">
              <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <p className="text-xs" style={{ color: '#7a7e92' }}>
                Tối thiểu 6 ký tự.
              </p>
            </Field>
            <button
              type="submit"
              disabled={submitting || otp.length !== 6 || newPw.length < 6}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              style={{
                background: NAVY,
                color: '#fff',
                boxShadow: '0 2px 12px rgba(26,40,69,0.18)',
              }}
            >
              {submitting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
            </button>
            <div className="flex justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setNewPw('');
                }}
                className="font-medium hover:underline"
                style={{ color: '#7a7e92' }}
              >
                ← Đổi email
              </button>
              <button
                type="button"
                onClick={requestOtp}
                disabled={submitting}
                className="font-medium hover:underline disabled:opacity-50"
                style={{ color: NAVY }}
              >
                Gửi lại OTP
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
