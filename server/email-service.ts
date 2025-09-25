import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";

const DEFAULT_SMTP_HOST = "smtp.mailgun.org";
const DEFAULT_SMTP_PORT = 587;

const sanitizeEnv = (value?: string | null) => {
  if (!value) return undefined;
  return value.replace(/^['"]|['"]$/g, "").trim();
};

const resolveBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

let cachedTransporter: nodemailer.Transporter | null = null;

const resolveAuthCredentials = () => {
  const user = sanitizeEnv(process.env.SMTP_USER) || sanitizeEnv(process.env.MAILGUN_SMTP_USER);
  const pass = sanitizeEnv(process.env.SMTP_PASS) || sanitizeEnv(process.env.MAILGUN_SMTP_PASS) || sanitizeEnv(process.env.MAILGUN_API_KEY);
  return { user, pass };
};

const getDefaultFrom = () => {
  const { user } = resolveAuthCredentials();
  const email = sanitizeEnv(process.env.EMAIL_FROM_ADDRESS) || sanitizeEnv(process.env.SMTP_FROM_EMAIL) || user || "noreply@affluvia.com";
  const name = sanitizeEnv(process.env.EMAIL_FROM_NAME) || "Affluvia";
  return { email, name };
};

const formatFromAddress = (name?: string, email?: string) => {
  const defaults = getDefaultFrom();
  const finalEmail = email || defaults.email;
  const finalName = name !== undefined ? name : defaults.name;
  return finalName ? `"${finalName}" <${finalEmail}>` : finalEmail;
};

// Create reusable transporter object using SMTP transport (Mailgun by default)
const createTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = sanitizeEnv(process.env.SMTP_HOST) || sanitizeEnv(process.env.MAILGUN_SMTP_HOST) || DEFAULT_SMTP_HOST;
  const port = Number(sanitizeEnv(process.env.SMTP_PORT) || sanitizeEnv(process.env.MAILGUN_SMTP_PORT) || DEFAULT_SMTP_PORT);
  const secure = resolveBoolean(sanitizeEnv(process.env.SMTP_SECURE), port === 465);
  const { user, pass } = resolveAuthCredentials();

  if (!user || !pass) {
    console.warn("Email service not configured. Set SMTP_USER and SMTP_PASS (or Mailgun credentials).");
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { ciphers: "TLSv1.2" },
  });

  return cachedTransporter;
};

export interface InvestmentUpdateEmailOptions {
  to: string[];
  subject: string;
  message: string;
  tabName: string;
  senderName: string;
}

export async function sendInvestmentUpdateEmail(options: InvestmentUpdateEmailOptions): Promise<boolean> {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.error('Email transporter not configured');
    // In development, we'll just log the email that would be sent
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode - Email that would be sent:', {
        to: options.to,
        subject: options.subject,
        message: options.message,
        tab: options.tabName
      });
      return true;
    }
    return false;
  }

  try {
    // Create HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .tab-badge {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 5px 15px;
              border-radius: 20px;
              font-size: 14px;
              margin-bottom: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Affluvia Investment Update</h1>
          </div>
          <div class="content">
            <div class="tab-badge">📊 ${options.tabName}</div>
            <h2>${options.subject}</h2>
            <div style="white-space: pre-wrap;">${options.message}</div>
          </div>
          <div class="footer">
            <p>This update was sent by ${options.senderName} from Affluvia Investment Platform.</p>
            <p>© ${new Date().getFullYear()} Affluvia. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const mailOptions: SendMailOptions = {
      from: formatFromAddress("Affluvia Admin"),
      bcc: options.to, // Use BCC to protect user privacy
      subject: `[Affluvia ${options.tabName}] ${options.subject}`,
      text: options.message,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Investment update email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send investment update email:', error);
    return false;
  }
}

export async function sendAdvisorInviteEmail({ to, advisorName, link, replyTo }: { to: string; advisorName: string; link: string; replyTo?: string; }): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode - Advisor Invite Email that would be sent:', { to, advisorName, link });
      return true;
    }
    console.error('Email transporter not configured');
    return false;
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; }
            .container { max-width: 640px; margin: 0 auto; padding: 24px; }
            .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; padding: 24px; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; }
            .btn { display: inline-block; padding: 12px 20px; background: #7c3aed; color: #fff !important; border-radius: 8px; text-decoration: none; }
            .muted { color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>You're invited to Affluvia</h1></div>
            <div class="content">
              <p>${advisorName} has invited you to securely share and plan your finances in Affluvia.</p>
              <p>Click the button below to create your account and connect with your advisor.</p>
              <p style="margin: 24px 0;">
                <a class="btn" href="${link}" target="_blank" rel="noopener">Accept Invitation</a>
              </p>
              <p class="muted">This link expires in 7 days. If the button doesn't work, paste this URL in your browser:<br/>${link}</p>
            </div>
            <p class="muted" style="text-align:center;">© ${new Date().getFullYear()} Affluvia</p>
          </div>
        </body>
      </html>
    `;

    const defaults = getDefaultFrom();
    const defaultSenderName = `${advisorName} via ${defaults.name}`;
    const fromAddress = formatFromAddress(defaultSenderName);
    const mailOptions: SendMailOptions = {
      from: fromAddress,
      to,
      subject: `${advisorName} invited you to Affluvia` ,
      html: htmlContent,
      replyTo: replyTo || defaults.email,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Advisor invite email sent:', result.messageId);
    return true;
  } catch (err) {
    console.error('Failed to send advisor invite email:', err);
    return false;
  }
}
