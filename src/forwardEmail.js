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
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'localhost',
          port: process.env.SMTP_PORT || 25,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        })

        const chunks = []
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', async () => {
          const emailContent = Buffer.concat(chunks).toString()

          await transporter.sendMail({
            from,
            to: forwardAddress,
            raw: emailContent,
          })

          logger.info(`Email forwarded to ${forwardAddress}`)
        })
      } catch (error) {
        logger.error(`Error forwarding email to ${forwardAddress}: ${error.message}`)
      }
    }
  } else {
    logger.error('forwardAddresses is not an array:', forwardAddresses)
  }
}