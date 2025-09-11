const nodemailer = require('nodemailer')
const logger = require('./logger')
require('dotenv').config()

module.exports.forwardEmail = async function (recipient, configData, letterData) {
  const { to, from, subject, text, attachmentPaths } = letterData
  const forwardAddresses = configData.forwardingRules.forwardRules[recipient]
  logger.info('Forwarding email to:', forwardAddresses)

  if (Array.isArray(forwardAddresses)) {
    for (const forwardAddress of forwardAddresses) {
      logger.info(`Forwarding email to ${forwardAddress}`)
      if (typeof forwardAddress === 'string' && to.trim() === forwardAddress.trim()) {
        logger.info(`Skipping forwarding to ${forwardAddress} as it matches the sender address`)
        continue
      }

      try {
        const success = await sendEmail(forwardAddress, from, subject, text, attachmentPaths)
        if (success) {
          logger.info(`Email successfully forwarded to ${forwardAddress}`)
        } else {
          logger.error(`Failed to forward email to ${forwardAddress}`)
        }
      } catch (error) {
        logger.error(`Error forwarding email to ${forwardAddress}: ${error.message}`)
      }
    }
  } else {
    logger.error('forwardAddresses is not an array:', forwardAddresses)
  }
}

async function sendEmail(forwardAddress, from, subject, text, attachmentPaths) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER_SILVER,
      pass: process.env.EMAIL_PASSWORD_SILVER,
    },
  })

  const mailOptions = {
    from: process.env.EMAIL_USER_SILVER,
    to: forwardAddress,
    subject: subject || 'Forwarded Email',
    text: text || '',
    replyTo: from,
    attachments: attachmentPaths.map((filePath) => ({
      path: filePath,
    })),
    headers: {
      'X-Relay-Processed': 'true'
    }
  }

  try {
    await transporter.sendMail(mailOptions)
    logger.info(`Message to ${forwardAddress} sent successfully`)
    return true
  } catch (error) {
    logger.error(`Error sending email to ${forwardAddress}: ${error.message}`)
    return false
  }
}