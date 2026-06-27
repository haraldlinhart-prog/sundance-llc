import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { fname, lname, email, country, service, message, elapsed, website } = req.body

  if (website) return res.status(200).json({ ok: true })
  if (!elapsed || elapsed < 3) return res.status(400).json({ error: 'Too fast' })
  if (!fname || !email || !message) return res.status(400).json({ error: 'Missing fields' })
  if (message.split(' ').some(w => w.length > 60)) return res.status(400).json({ error: 'Spam' })
  if ((fname + lname).length > 100) return res.status(400).json({ error: 'Spam' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' })

  try {
    await resend.emails.send({
      from: process.env.CONTACT_FROM || 'noreply@pan21.com',
      to: 'info@sundance-llc.com',
      replyTo: email,
      subject: 'New Enquiry – Sundance LLC – ' + (service || 'General') + ' from ' + fname + ' ' + lname,
      html: `
        <h2>New Enquiry – Sundance LLC</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;font-weight:bold;width:140px">Name:</td><td style="padding:8px">${fname} ${lname}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Email:</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px;font-weight:bold">Country:</td><td style="padding:8px">${country || '–'}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Service:</td><td style="padding:8px">${service || '–'}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;vertical-align:top">Message:</td><td style="padding:8px">${message.replace(/\n/g, '<br>')}</td></tr>
        </table>
        <p style="color:#999;font-size:12px;margin-top:24px">Sent via sundance-llc.com | Form dwell time: ${elapsed}s</p>
      `,
    })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Mail failed' })
  }
}
