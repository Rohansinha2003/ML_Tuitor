import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const transporter = env.emailConfigured ? nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  requireTLS: env.SMTP_PORT !== 465,
  connectionTimeout: 8_000,
  greetingTimeout: 8_000,
  socketTimeout: 8_000,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
}) : null

export async function sendAccountEmail(to: string, subject: string, text: string, html?: string) {
  if (!transporter || !env.EMAIL_FROM) throw new Error('Email delivery is not configured')
  await transporter.sendMail({
    from: `"DeepNova Studio" <${env.EMAIL_FROM}>`,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  })
}

function baseEmailTemplate({
  headline,
  subhead,
  contentHtml,
  buttonText,
  buttonUrl,
}: {
  headline: string
  subhead?: string
  contentHtml: string
  buttonText?: string
  buttonUrl?: string
}) {
  const homeUrl = env.CLIENT_ORIGIN
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #192a25;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f6f1; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #fffefa; border: 1px solid #dfe3dc; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(25, 42, 37, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 24px; border-bottom: 1px solid #dfe3dc; background-color: #fcfcf9;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; width: 28px; height: 28px; background-color: #1c6149; border-radius: 7px; color: #ffffff; text-align: center; line-height: 28px; font-weight: bold; font-size: 15px;">D</span>
                    <span style="font-size: 18px; font-weight: 700; color: #192a25; margin-left: 8px; letter-spacing: -0.2px;">deep<span style="color: #1c6149;">nova</span></span>
                  </td>
                  <td align="right">
                    <span style="font-size: 10px; font-family: monospace; color: #97a099; letter-spacing: 1px;">FIELD NOTES 01</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 28px;">
              <h1 style="font-size: 24px; font-weight: 600; color: #192a25; margin: 0 0 10px; line-height: 1.3;">${headline}</h1>
              ${subhead ? `<p style="font-size: 14px; color: #68736c; margin: 0 0 24px; line-height: 1.6;">${subhead}</p>` : ''}
              
              <div style="font-size: 14px; color: #192a25; line-height: 1.7; margin-bottom: 28px;">
                ${contentHtml}
              </div>

              ${buttonText && buttonUrl ? `
              <div style="text-align: center; margin: 32px 0 28px;">
                <a href="${buttonUrl}" style="display: inline-block; background-color: #1c6149; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 6px; box-shadow: 0 2px 8px rgba(28, 97, 73, 0.25);">
                  ${buttonText} &rarr;
                </a>
              </div>
              ` : ''}

              <!-- Home Page Navigation Box -->
              <div style="background-color: #f6f6f1; border: 1px solid #dfe3dc; border-radius: 8px; padding: 18px 20px; margin-top: 32px;">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #1c6149;">DeepNova Links</p>
                <p style="margin: 0; font-size: 13px; color: #68736c; line-height: 1.6;">
                  Visit your home page anytime:<br>
                  <a href="${homeUrl}" style="color: #1c6149; font-weight: 600; word-break: break-all;">${homeUrl}</a>
                </p>
                <div style="margin-top: 10px; font-size: 12px; color: #97a099;">
                  <a href="${homeUrl}/curriculum" style="color: #68736c; text-decoration: none; margin-right: 14px;">Curriculum &rarr;</a>
                  <a href="${homeUrl}/playground" style="color: #68736c; text-decoration: none;">Interactive Labs &rarr;</a>
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px; border-top: 1px solid #dfe3dc; background-color: #fcfcf9; text-align: center;">
              <p style="font-size: 11px; color: #97a099; margin: 0 0 6px; font-family: monospace;">
                DEEPNOVA STUDIO &middot; LEARN BY UNDERSTANDING
              </p>
              <p style="font-size: 11px; color: #97a099; margin: 0;">
                Made for the long way in. You received this email because an account was registered with this address.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Sends a welcome confirmation email containing the verification link and home page URL.
 */
export async function sendWelcomeVerificationEmail(to: string, name: string, token: string) {
  const verifyUrl = `${env.CLIENT_ORIGIN}/verify-email?token=${token}`
  const homeUrl = env.CLIENT_ORIGIN

  const subject = `Welcome to DeepNova — Confirm your account`
  const text = `Welcome to DeepNova, ${name}!

Thank you for creating your account. Please confirm your email address by opening this verification link (valid for 24 hours):
${verifyUrl}

You can explore DeepNova anytime from our home page:
${homeUrl}

Curriculum: ${homeUrl}/curriculum
Playground: ${homeUrl}/playground

—
DeepNova Studio
Built for curious minds.`

  const html = baseEmailTemplate({
    headline: `Welcome to DeepNova, ${name}!`,
    subhead: 'Your account has been created. Please confirm your email to activate your learning workspace.',
    contentHtml: `
      <p style="margin: 0 0 14px;">
        We're thrilled to have you here. DeepNova is built to help you understand machine learning from first principles—no black boxes, just clear mathematical derivations and real-time visual labs.
      </p>
      <p style="margin: 0;">
        Click the button below to confirm your email and activate your account. This link will remain valid for 24 hours.
      </p>
    `,
    buttonText: 'Confirm Email & Enter Studio',
    buttonUrl: verifyUrl,
  })

  await sendAccountEmail(to, subject, text, html)
}

/**
 * Sends a welcome email after confirmation or automatic verification, containing the home page URL.
 */
export async function sendWelcomeEmail(to: string, name: string) {
  const homeUrl = env.CLIENT_ORIGIN

  const subject = `Welcome to DeepNova — You're all set!`
  const text = `Welcome to DeepNova, ${name}!

Your account has been confirmed and is ready to use.

Start exploring machine learning from first principles on our home page:
${homeUrl}

Quick links:
• Home Page: ${homeUrl}
• Studio Overview: ${homeUrl}/overview
• Curriculum: ${homeUrl}/curriculum
• Interactive Playground: ${homeUrl}/playground

—
DeepNova Studio
Built for curious minds.`

  const html = baseEmailTemplate({
    headline: `Welcome aboard, ${name}!`,
    subhead: 'Your account is confirmed and your personal learning workspace is active.',
    contentHtml: `
      <p style="margin: 0 0 14px;">
        Your DeepNova account is all set. You now have access to all 17 interactive lessons, 2D parameter simulators, bookmarks, and quiz progress synced to the cloud.
      </p>
      <p style="margin: 0;">
        Ready to dive in? Launch the studio from our home page or explore our interactive playgrounds.
      </p>
    `,
    buttonText: 'Open DeepNova Home Page',
    buttonUrl: homeUrl,
  })

  await sendAccountEmail(to, subject, text, html)
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${env.CLIENT_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`
  const subject = 'Reset your DeepNova password'
  const text = `We received a request to reset your DeepNova password.

Open this link within 30 minutes to choose a new password:
${resetUrl}

If you did not request this, you can safely ignore this email.

—
DeepNova Studio`
  const html = baseEmailTemplate({
    headline: 'Reset your password.',
    subhead: 'We received a request to update your DeepNova account password.',
    contentHtml: `
      <p style="margin: 0 0 14px;">
        Use the button below to choose a new password. This link is single-use and expires in 30 minutes.
      </p>
      <p style="margin: 0;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    `,
    buttonText: 'Choose New Password',
    buttonUrl: resetUrl,
  })

  await sendAccountEmail(to, subject, text, html)
}
