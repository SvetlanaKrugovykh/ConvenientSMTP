const nodemailer = require('nodemailer')
const logger = require('./logger')
require('dotenv').config()

module.exports.forwardEmail = async function (stream, recipient, configData, letterData) {
  const { to, from } = letterData
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
        const chunks = []
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', async () => {
          const emailContent = Buffer.concat(chunks).toString()

          const success = await sendEmail(forwardAddress, from, emailContent)
          if (success) {
            logger.info(`Email successfully forwarded to ${forwardAddress}`)
          } else {
            logger.error(`Failed to forward email to ${forwardAddress}`)
          }
        })
      } catch (error) {
        logger.error(`Error forwarding email to ${forwardAddress}: ${error.message}`)
      }
    }
  } else {
    logger.error('forwardAddresses is not an array:', forwardAddresses)
  }
}

async function sendEmail(forwardAddress, from, rawEmail) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER_SILVER,
      pass: process.env.EMAIL_PASSWORD_SILVER,
    },
  })

  const mailOptions = {
    from: process.env.EMAIL_USER_SILVER,
    raw: rawEmail,
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