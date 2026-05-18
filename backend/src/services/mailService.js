const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

async function sendPasswordResetEmail(to, code) {
  const info = await getTransporter().sendMail({
    from: env.emailFrom,
    to,
    subject: 'Your password reset code',
    text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires in 15 minutes.</p>`,
  });
  return info;
}

module.exports = { sendPasswordResetEmail };
