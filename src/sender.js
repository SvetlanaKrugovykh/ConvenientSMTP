const nodemailer = require('nodemailer')
const config = require('./config')
const { PassThrough } = require('stream')
const logger = require('./logger')
const { relay } = require('./relay')
require('dotenv').config()

module.exports.sendEMail = async function (from, to, subject, text, user, pass) {
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

  try {
    let info = await transporter.sendMail({
      from,
      to,
      subject,
      text
    })

    logger.info('Message sent: %s', info.messageId)
  } catch (error) {
    logger.error('Error sending email:', error)
  }
}

module.exports.relayEmail = async function (emailData, callback) {
  logger.info('relayEmail called with:', emailData)
  const stream = new PassThrough()
  stream.end(emailData.text)

  const session = {
    envelope: {
      mailFrom: { address: emailData.from },
      rcptTo: [{ address: emailData.to }]
    }
  }

  const forwardingRules = {
    validRecipients: [emailData.to],
    blacklist: [],
    rules: {}
  }

  relay(stream, session, callback, forwardingRules, {
    onData: (stream, session, callback) => {
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
        from: session.envelope.mailFrom.address,
        to: session.envelope.rcptTo[0].address,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        attachments: emailData.attachments
      }

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          logger.error('Error sending email:', error)
          return callback(error)
        }
        logger.info('The letter sent:', info.response)
        callback(null, info)
      })
    }
  })
}