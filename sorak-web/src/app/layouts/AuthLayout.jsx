import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex" style={{ fontFamily: '"Be Vietnam Pro", system-ui, sans-serif' }}>
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-col justify-center relative overflow-hidden flex-1 px-16"
        style={{ background: '#1a2845' }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Amber accent bar */}
        <div
          className="absolute top-0 left-0 bottom-0 w-1"
          style={{ background: '#f5a623' }}
        />

        <div className="relative z-10 max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <img src="/sorak-logo.png" alt="Sorak" className="h-9 w-9 object-contain" />
            <span className="text-xl font-black tracking-tight" style={{ color: '#ffffff' }}>
              Sorak<span style={{ color: '#f5a623' }}>.</span>
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-5xl font-black leading-tight mb-6" style={{ color: '#ffffff', letterSpacing: '-0.02em' }}>
            Hệ thống<br />
            quản lý<br />
            <span style={{ color: '#f5a623' }}>giáo dục</span><br />
            mầm non.
          </h2>

          {/* Divider */}
          <div className="w-12 h-1 rounded-full mb-6" style={{ background: '#f5a623' }} />

          {/* Description */}
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Triển khai tại Trường Mầm non Hòn Tre — quản lý học sinh, giáo viên và phụ huynh trên một nền tảng.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        className="flex flex-col items-center justify-center min-h-screen w-full lg:w-[480px] lg:min-w-[480px] lg:max-w-[480px] px-8 py-10"
        style={{ background: '#ffffff' }}
      >
        {/* Mobile brand */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <img src="/sorak-logo.png" alt="Sorak" className="h-12 w-12 object-contain mb-2" />
          <span className="text-2xl font-black" style={{ color: '#1a2845' }}>
            Sorak<span style={{ color: '#f5a623' }}>.</span>
          </span>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#1a2845' }}>
            Đăng nhập
          </h2>
          <p className="text-sm mb-8" style={{ color: '#7a7e92' }}>
            Vui lòng đăng nhập để tiếp tục sử dụng hệ thống.
          </p>

          <Outlet />
        </div>

        <p className="text-xs text-center mt-10" style={{ color: '#7a7e92' }}>
          © {new Date().getFullYear()} Sorak — Trường Mầm non Hòn Tre, Kiên Hải
        </p>
      </div>
    </div>
  );
}
