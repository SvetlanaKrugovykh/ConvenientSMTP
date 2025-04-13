const logger = require('./logger')
const simpleParser = require('mailparser').simpleParser
const { processEmail } = require('./processEmail')

module.exports.relayReceiveExternal = async function (stream, session, callback, configData) {
  let emailBody = ''

  logger.info('relayReceiveExternal called for external incoming mail')

  stream.on('data', (chunk) => {
    emailBody += chunk.toString()
  })

  stream.on('end', async () => {
    try {
      const parsed = await simpleParser(emailBody)
      const sender = session.envelope.mailFrom.address.trim()
      const recipients = session.envelope.rcptTo.map((rcpt) => rcpt.address.trim())
      const subject = parsed.subject || 'No Subject'
      const text = parsed.html || parsed.text
      const attachments = parsed.attachments || []

      logger.info(`Parsed email from ${sender} to ${recipients.join(', ')}`)
      logger.info('Email received and parsed. Attachments:', attachments.map((a) => a.filename))

      await processEmail(recipients, sender, subject, text, attachments, configData)

      logger.info('Email processed successfully for all recipients')
    } catch (error) {
      logger.error('Error processing external email:', error)
    }

    callback()
  })
}