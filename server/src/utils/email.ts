import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const transporter = env.emailConfigured ? nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
}) : null

export async function sendAccountEmail(to: string, subject: string, text: string) {
  if (!transporter || !env.EMAIL_FROM) throw new Error('Email delivery is not configured')
  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, text })
}
