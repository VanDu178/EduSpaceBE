import nodemailer from 'nodemailer';

export interface SendResetPasswordEmailParams {
  to: string;
  name?: string | null;
  newPassword: string;
  loginUrl: string;
}

/**
 * Khởi tạo transporter cho nodemailer
 */
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Gửi email thông báo đặt lại mật khẩu mới cho người dùng
 */
export const sendResetPasswordEmail = async ({
  to,
  name,
  newPassword,
  loginUrl,
}: SendResetPasswordEmailParams): Promise<boolean> => {
  const transporter = createTransporter();
  const fromEmail = process.env.EMAIL_FROM;
  const clientUrl = process.env.CLIENT_FE_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const logoUrl = process.env.APP_LOGO_URL || `${clientUrl}/logo.png`;

  if (!fromEmail) {
    console.warn(`
      =====================================================
      [EMAIL SERVICE - MISSING CONFIGURATION]
      EMAIL_FROM: ${fromEmail}
      (Vui lòng cấu hình EMAIL_FROM trong .env)
      =====================================================
    `);
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu - TradeVerse</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
    
    <!-- Light Mode Header with Logo -->
    <div style="background-color: #ffffff; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
      <img src="${logoUrl}" alt="TradeVerse Logo" style="max-height: 60px; width: auto; display: block; margin: 0 auto 10px auto;" />
      <h1 style="color: #0f172a; font-size: 20px; margin: 0; font-weight: 600; letter-spacing: 0.5px;">TradeVerse</h1>
    </div>

    <!-- Body Content -->
    <div style="padding: 32px 24px;">
      <h2 style="color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
        Yêu cầu Đặt lại Mật khẩu
      </h2>
      
      <p style="line-height: 1.6; color: #475569; margin-bottom: 20px; font-size: 15px;">
        Xin chào <strong>${name || 'Người dùng'}</strong>,
      </p>
      
      <p style="line-height: 1.6; color: #475569; margin-bottom: 24px; font-size: 15px;">
        Mật khẩu tài khoản <strong>TradeVerse</strong> của bạn đã được Quản trị viên đặt lại thành công. Dưới đây là thông tin đăng nhập mới của bạn:
      </p>

      <!-- Account Info Box -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 18px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;">
          <strong>Email đăng nhập:</strong> <span style="color: #2563eb; font-weight: 500;">${to}</span>
        </p>
        <p style="margin: 0; color: #334155; font-size: 14px;">
          <strong>Mật khẩu mới:</strong> <span style="background-color: #e2e8f0; padding: 4px 10px; border-radius: 4px; font-family: Consolas, Monaco, monospace; font-size: 15px; font-weight: bold; color: #0f172a; letter-spacing: 1px;">${newPassword}</span>
        </p>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">
          Đăng nhập ngay
        </a>
      </div>

      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 14px; margin-top: 24px;">
        <p style="font-size: 13px; color: #b45309; margin: 0; line-height: 1.5;">
          ⚠️ <strong>Lưu ý bảo mật:</strong> Vì lý do an toàn, vui lòng tiến hành đổi mật khẩu ngay sau khi đăng nhập thành công. Không chia sẻ thông tin này cho người khác.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Email này được gửi tự động từ hệ thống TradeVerse. Vui lòng không trả lời trực tiếp email này.
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">
        &copy; 2026 TradeVerse. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `;

  // Trường hợp không có cấu hình SMTP -> Fallback log console
  if (!transporter) {
    console.warn(`
      =====================================================
      [EMAIL SERVICE - MOCK MODE / MISSING SMTP CONFIG]
      To: ${to}
      From: ${fromEmail}
      Subject: Đặt lại mật khẩu tài khoản TradeVerse
      Logo URL: ${logoUrl}
      New Password: ${newPassword}
      Login URL: ${loginUrl}
      (Vui lòng cấu hình SMTP_HOST, SMTP_USER, SMTP_PASS trong file .env để gửi email thật)
      =====================================================
    `);
    return true;
  }

  try {
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: '🔑 [TradeVerse] Đặt lại mật khẩu tài khoản thành công',
      html: htmlContent,
    });
    console.log(`[EMAIL SERVICE] Đã gửi email reset password thành công tới: ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL SERVICE ERROR] Lỗi khi gửi email qua SMTP:', error);
    // Vẫn log ra console phòng trường hợp gửi mail qua SMTP bị lỗi
    console.log(`[FALLBACK LOG] Password cho ${to} là: ${newPassword}`);
    return false;
  }
};

export interface SendForgotPasswordOtpEmailParams {
  to: string;
  name?: string | null;
  otp: string;
}

/**
 * Gửi email chứa mã OTP xác thực khôi phục mật khẩu cho người dùng
 */
export const sendForgotPasswordOtpEmail = async ({
  to,
  name,
  otp,
}: SendForgotPasswordOtpEmailParams): Promise<boolean> => {
  const transporter = createTransporter();
  const fromEmail = process.env.EMAIL_FROM;
  const clientUrl = process.env.CLIENT_FE_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const logoUrl = process.env.APP_LOGO_URL || `${clientUrl}/logo.png`;

  if (!fromEmail) {
    console.warn(`
      =====================================================
      [EMAIL SERVICE - MISSING CONFIGURATION]
      EMAIL_FROM: ${fromEmail}
      (Vui lòng cấu hình EMAIL_FROM trong .env)
      =====================================================
    `);
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã OTP Đặt lại mật khẩu - TradeVerse</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
    
    <!-- Light Mode Header with Logo -->
    <div style="background-color: #ffffff; padding: 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
      <img src="${logoUrl}" alt="TradeVerse Logo" style="max-height: 60px; width: auto; display: block; margin: 0 auto 10px auto;" />
      <h1 style="color: #0f172a; font-size: 20px; margin: 0; font-weight: 600; letter-spacing: 0.5px;">TradeVerse</h1>
    </div>

    <!-- Body Content -->
    <div style="padding: 32px 24px;">
      <h2 style="color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
        Xác Thực Đặt Lại Mật Khẩu
      </h2>
      
      <p style="line-height: 1.6; color: #475569; margin-bottom: 20px; font-size: 15px;">
        Xin chào <strong>${name || 'Người dùng'}</strong>,
      </p>
      
      <p style="line-height: 1.6; color: #475569; margin-bottom: 24px; font-size: 15px;">
        Bạn vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản <strong>TradeVerse</strong> (${to}). Dưới đây là mã xác thực OTP của bạn:
      </p>

      <!-- OTP Box -->
      <div style="background-color: #f8fafc; border: 1px dashed #2563eb; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
          Mã OTP xác thực
        </p>
        <span style="font-family: Consolas, Monaco, monospace; font-size: 32px; font-weight: 800; color: #2563eb; letter-spacing: 8px; display: inline-block;">${otp}</span>
      </div>

      <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 6px; padding: 14px; margin-top: 24px;">
        <p style="font-size: 13px; color: #1e40af; margin: 0; line-height: 1.5;">
          ⏰ <strong>Thời gian hiệu lực:</strong> Mã OTP này có hiệu lực trong vòng <strong>10 phút</strong>. Vì lý do an toàn, tuyệt đối không chia sẻ mã này cho bất kỳ ai.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Email này được gửi tự động từ hệ thống TradeVerse. Vui lòng không trả lời trực tiếp email này.
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">
        &copy; 2026 TradeVerse. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `;

  if (!transporter) {
    console.warn(`
      =====================================================
      [EMAIL SERVICE - MOCK MODE / MISSING SMTP CONFIG]
      To: ${to}
      From: ${fromEmail}
      Subject: [TradeVerse] Mã OTP đặt lại mật khẩu
      OTP Code: ${otp}
      (Vui lòng cấu hình SMTP_HOST, SMTP_USER, SMTP_PASS trong file .env để gửi email thật)
      =====================================================
    `);
    return true;
  }

  try {
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: '🔐 [TradeVerse] Mã OTP xác thực đặt lại mật khẩu',
      html: htmlContent,
    });
    console.log(`[EMAIL SERVICE] Đã gửi email mã OTP thành công tới: ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL SERVICE ERROR] Lỗi khi gửi email OTP qua SMTP:', error);
    console.log(`[FALLBACK LOG] OTP cho ${to} là: ${otp}`);
    return false;
  }
};



