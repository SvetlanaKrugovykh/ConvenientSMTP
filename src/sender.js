const nodemailer = require('nodemailer')
const config = require('./config')
require('dotenv').config()

module.exports.sendMail = async function (from, to, subject, text, user, pass) {

  const transporter = nodemailer.createTransport({
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

module.exports.relayEmail = async function (emailData, callback) {

  const transporter = nodemailer.createTransport({
    host: config.server,
    port: config.port,
    secure: false,
    tls: {
      rejectUnauthorized: false
    },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })

  const mailOptions = {
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    text: emailData.text,
    html: emailData.html
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return callback(error)
    }
    console.log('The letter sent:', info.response)
    callback(null, info)
  })
}