const nodemailer = require('nodemailer')
const config = require('./config')

module.exports.sendMail = async function (from, to, subject, text, user, pass) {
  let transporter = nodemailer.createTransport({
    host: config.server,
    port: config.port,
    secure: false,
    tls: {
      rejectUnauthorized: false
    },
    auth: {
      user,
      pass
    }
  })

  let info = await transporter.sendMail({
    from,
    to,
    subject,
    text
  })

  console.log('Message sent: %s', info.messageId)
}
