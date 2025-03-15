const { PassThrough } = require('stream')
const logger = require('./logger')
const { saveEmail } = require('../db/saveEmail')
const simpleParser = require('mailparser').simpleParser
const fs = require('fs')
const path = require('path')
const configData = require('./config')

module.exports.relay = function (stream, session, callback, server) {
  const recipient = session.envelope.rcptTo[0].address.trim()
  const sender = session.envelope.mailFrom.address.trim()
  let emailBody = ''

  logger.info('Checking recipient:', recipient)
  logger.info('Checking sender:', sender)

  if (!configData.forwardingRules.validRecipients.map(e => e.trim()).includes(recipient)) {
    logger.info('Recipient is not allowed')
    return callback(new Error('Recipient is not allowed'))
  }

  if (configData.forwardingRules.blacklist.map(e => e.trim()).includes(sender)) {
    logger.info('Sender is blacklisted')
    return callback(new Error('Sender is blacklisted'))
  }

  if (configData.forwardingRules.forwardRules[recipient]) {
    const forwardAddresses = configData.forwardingRules.forwardRules[recipient]
    logger.info('Forwarding email to:', forwardAddresses)

    if (Array.isArray(forwardAddresses)) {
      forwardAddresses.forEach((forwardAddress, index) => {
        logger.info(`Forwarding email to ${forwardAddress} (index: ${index})`)
        if (session.envelope.mailFrom.address.trim() === forwardAddress.trim()) {
          logger.info(`Skipping forwarding to ${forwardAddress} as it matches the sender address`)
          return
        }

        const forwardStream = new PassThrough()
        stream.pipe(forwardStream)

        const forwardSession = {
          envelope: {
            mailFrom: session.envelope.mailFrom,
            rcptTo: [{ address: forwardAddress }]
          }
        }

        logger.info('Forward session:', forwardSession)

        try {
          server.onData(forwardStream, forwardSession, (err) => {
            if (err) {
              logger.error('Error forwarding email: ' + err.message)
              return
            }
            logger.info('Email forwarded to ' + forwardAddress)
          })
        } catch (error) {
          logger.error('Exception in server.onData: ' + error.message)
        }
      })
    } else {
      logger.error('forwardAddresses is not an array:', forwardAddresses)
    }
  }

  stream.on('data', (chunk) => {
    emailBody += chunk.toString()
  })

  stream.pipe(process.stdout)

  stream.on('end', async () => {
    const to = session.envelope.rcptTo[0].address
    const from = session.envelope.mailFrom.address
    logger.info(`Received email from ${from} to ${to}`)
    logger.info(`Email body: ${emailBody}`)

    try {
      const parsed = await simpleParser(emailBody)
      const subject = parsed.subject || 'No Subject'
      const attachments = parsed.attachments || []
      const attachmentPaths = []
      for (const attachment of attachments) {
        const attachmentPath = path.join(__dirname, process.env.ATTACHMENT_PATH, attachment.filename)
        fs.writeFileSync(attachmentPath, attachment.content)
        attachmentPaths.push(attachmentPath)
      }

      await saveEmail(to, from, subject, emailBody, attachmentPaths)
      logger.info('Email saved to database')
    } catch (error) {
      logger.error('Error saving email:', error)
    }

    callback()
  })
}