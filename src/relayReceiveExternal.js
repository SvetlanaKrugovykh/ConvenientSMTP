const logger = require('./logger')
const simpleParser = require('mailparser').simpleParser
const { processEmail } = require('./processEmail')
const { containsSpamContent, reportSpamToGmail } = require('./spamChecker')

module.exports.relayReceiveExternal = async function (stream, session, callback, configData) {
  const recipients = session.envelope.rcptTo.map((rcpt) => rcpt.address.trim().toLowerCase())
  const sender = session.envelope.mailFrom.address.trim().toLowerCase()
  let emailBody = ''

  logger.info('relayReceiveExternal called for external incoming mail')
  logger.info('Checking recipients:', recipients.join(', '))
  logger.info('Checking sender:', sender)

  const isSpam = configData.forwardingRules.antispamList.some((entry) => {
    return sender === entry || sender.endsWith(entry)
  })

  if (isSpam) {
    logger.warn(`Blocked spam email from ${sender}`)
    return callback(new Error('Your email was identified as spam and rejected.'))
  }

  stream.on('data', (chunk) => {
    emailBody += chunk.toString()
  })

  stream.on('end', async () => {
    logger.info(`Received email from ${sender} to ${recipients.join(', ')}`)

    try {
      if (containsSpamContent(emailBody, configData.forwardingRules.spamContentList)) {
        logger.warn(`Blocked spam email from ${sender} due to spam content`)

        if (sender.endsWith('@gmail.com')) {
          await reportSpamToGmail(sender, emailBody)
        }

        return callback(new Error('Your email was identified as spam and rejected due to content.'))
      }

      const parsed = await simpleParser(emailBody)
      const subject = parsed.subject || 'No Subject'
      const text = parsed.text || parsed.html || ''
      const attachments = parsed.attachments || []

      logger.info('Email received and parsed. Attachments:', attachments.map((a) => a.filename))

      await processEmail(recipients, sender, subject, text, attachments, configData)

      logger.info('Email processed successfully for all recipients')
    } catch (error) {
      logger.error('Error processing email:', error)
    }

    callback()
  })
}