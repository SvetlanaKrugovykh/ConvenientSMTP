const nodemailer = require('nodemailer')
const config = require('./config')

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

module.exports.sendMail = async function (from, to, subject, text, user, pass) {

  let info = await transporter.sendMail({
    from,
    to,
    subject,
    text
  })

  console.log('Message sent: %s', info.messageId)
}

module.exports.relayEmail = async function (emailData, callback) {

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