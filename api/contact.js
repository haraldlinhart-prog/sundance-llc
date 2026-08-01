import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Catches bot-generated random tokens that are short enough to slide past a simple
// length check but look nothing like a real word: very few vowels AND unnaturally
// frequent upper/lowercase switching. Both conditions required together to avoid
// flagging real oddly-cased words (e.g. "McDonald").
// E-Mail-Blockliste — normalisiert Gmail-Punkte/Plus-Tags, damit Bots sie nicht
// durch e.dip.a.ju.l.o.d.ev.8.5@gmail.com vs. ed.ip.ajulo.de.v85@gmail.com umgehen.
const BLOCKED_EMAILS = new Set([
  'zazacukeq266@gmail.com',
  'ugibanicepi459@gmail.com',
  'edipajulodev85@gmail.com',
]);
function normalizeEmail(email) {
  const e = (email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at === -1) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  local = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
  }
  return local + '@' + (domain === 'googlemail.com' ? 'gmail.com' : domain);
}

function isGibberish(str) {
  const trimmed = (str || '').trim();

  // Eine komplette Nachricht, die aus einem einzigen zusammenhängenden Token
  // mit gemischter Groß-/Kleinschreibung besteht (keine Leerzeichen, keine
  // Satzzeichen), ist praktisch nie eine echte menschliche Nachricht — auch
  // wenn der Vokalanteil zufällig hoch genug ist, um die Ratio-Prüfung unten
  // zu unterlaufen (z.B. durch zufällig viele "y"s).
  if (/^[a-zA-ZäöüÄÖÜß]{10,40}$/.test(trimmed) && /[a-zäöüß]/.test(trimmed) && /[A-ZÄÖÜ]/.test(trimmed)) {
    return true;
  }

  const words = (str || '').split(/\s+/).filter(w => w.length >= 6);
  const vowelChars = 'aeiouyAEIOUYäöüÄÖÜàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ';
  for (const word of words) {
    const letters = word.replace(/[^a-zA-ZäöüÄÖÜßàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ]/g, '');
    if (letters.length < 6) continue;
    let vowels = 0;
    for (const ch of letters) if (vowelChars.includes(ch)) vowels++;
    const vowelRatio = vowels / letters.length;
    let transitions = 0;
    for (let i = 1; i < letters.length; i++) {
      const prevUpper = letters[i - 1] === letters[i - 1].toUpperCase() && letters[i - 1] !== letters[i - 1].toLowerCase();
      const curUpper = letters[i] === letters[i].toUpperCase() && letters[i] !== letters[i].toLowerCase();
      if (prevUpper !== curUpper) transitions++;
    }
    const transitionRatio = transitions / (letters.length - 1);
    const vowelThreshold = letters.length >= 14 ? 0.28 : (letters.length >= 11 ? 0.22 : 0.16);
    if (vowelRatio < vowelThreshold && transitionRatio > 0.3) return true;
  }
  if (/\S{61,}/.test(str || '')) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { fname, lname, email, country, service, message, elapsed, website } = req.body

  // Gibberish-Bot-Erkennung (kurze Zufallsstrings) — silent success wie Honeypot
  if (isGibberish(message) || BLOCKED_EMAILS.has(normalizeEmail(email))) { return res.status(200).json({ ok: true }); }

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
