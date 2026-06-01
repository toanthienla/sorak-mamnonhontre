import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) return null;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

function buildOtpHtml(otp) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Mã OTP Sorak</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">

          <!-- Header navy -->
          <tr>
            <td style="background:#1a2845;padding:28px 36px 24px;">
              <!-- Logo wordmark -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;font-family:'Segoe UI',Arial,sans-serif;">
                      Sorak<span style="color:#f5a623;">.</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:4px;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.55);">Trường Mầm non Hòn Tre</span>
                  </td>
                </tr>
              </table>
              <!-- Amber divider -->
              <div style="margin-top:20px;height:2px;width:36px;background:#f5a623;border-radius:2px;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 28px;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a2845;">Đặt lại mật khẩu</p>
              <p style="margin:0 0 28px;font-size:14px;color:#7a7e92;line-height:1.6;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhập mã bên dưới để tiếp tục.
              </p>

              <!-- OTP box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#faf9f7;border:1.5px solid #eee8dc;border-radius:10px;padding:20px 40px;text-align:center;">
                      <p style="margin:0 0 6px;font-size:11px;color:#7a7e92;letter-spacing:1.5px;text-transform:uppercase;">Mã xác nhận OTP</p>
                      <p style="margin:0;font-size:38px;font-weight:800;color:#1a2845;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fffbeb;border-left:3px solid #f5a623;border-radius:0 6px 6px 0;padding:12px 14px;">
                    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
                      ⏱ Mã có hiệu lực trong <strong>10 phút</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Vì lý do bảo mật, không chia sẻ mã này với bất kỳ ai — kể cả nhân viên nhà trường.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f0f0f0;padding:16px 36px;background:#faf9f7;">
              <p style="margin:0;font-size:11px;color:#7a7e92;line-height:1.6;">
                © Sorak — Trường Mầm non Hòn Tre, Kiên Hải<br/>
                Email tự động · Vui lòng không trả lời email này.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(to, otp) {
  const t = getTransporter();
  if (!t) throw new Error('SMTP chưa cấu hình');
  await t.sendMail({
    from: env.smtp.from,
    to,
    subject: `[Sorak] Mã OTP đặt lại mật khẩu: ${otp}`,
    text: `Mã OTP của bạn: ${otp}\nMã hiệu lực trong 10 phút.\nNếu bạn không yêu cầu, bỏ qua email này.\n\n© Sorak — Trường Mầm non Hòn Tre`,
    html: buildOtpHtml(otp),
  });
  logger.info(`OTP email sent to ${to}`);
}
