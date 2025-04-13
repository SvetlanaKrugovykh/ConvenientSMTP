const dns = require('dns').promises
const SMTPConnection = require('smtp-connection')
const fs = require('fs')
const path = require('path')
const logger = require('./logger')
const simpleParser = require('mailparser').simpleParser
require('dotenv').config()


module.exports.relaySend = async function (stream, session, callback, configData) {
  const sender = session.envelope.mailFrom.address.trim().toLowerCase()
  const recipients = session.envelope.rcptTo.map((rcpt) => rcpt.address.trim().toLowerCase())

  logger.info(`relaySend called for sender: ${sender}, recipients: ${recipients.join(', ')}`)

  try {
    const emailContent = await parseStream(stream)

    const { subject, text, attachments } = emailContent
    const attachmentPaths = saveAttachments(attachments)

    for (const recipient of recipients) {
      const domain = recipient.split('@')[1]
      logger.info(`Resolving MX for domain: ${domain}`)

      let mxRecords
      try {
        mxRecords = await dns.resolveMx(domain)
      } catch (err) {
        logger.error(`Failed to resolve MX for ${domain}:`, err)
        continue
      }

      mxRecords.sort((a, b) => a.priority - b.priority)
      const targetMX = mxRecords[0].exchange

      logger.info(`Using MX server: ${targetMX} for recipient: ${recipient}`)

      const connection = new SMTPConnection({
        host: targetMX,
        port: 25,
        tls: { rejectUnauthorized: false },
      })

      try {
        await new Promise((resolve, reject) => {
          connection.connect(() => {
            logger.info(`Connected to target MX for recipient: ${recipient}`)
            resolve()
          })
          connection.on('error', reject)
        })

        const envelope = { from: sender, to: recipient }

        await new Promise((resolve, reject) => {
          connection.send(envelope, buildRawMessage({ sender, recipient, subject, text, attachmentPaths }), (err, info) => {
            if (err) return reject(err)
            logger.info(`Mail sent to ${recipient}:`, info)
            resolve(info)
          })
        })

        connection.quit()
      } catch (err) {
        logger.error(`Error sending mail to ${recipient}:`, err)
      }
    }

    callback()
  } catch (error) {
    logger.error('Error in relaySend:', error)
    callback(error)
  }
}

async function parseStream(stream) {
  return new Promise((resolve, reject) => {
    simpleParser(stream, (err, parsed) => {
      if (err) return reject(err)
      resolve(parsed)
    })
  })
}

function saveAttachments(attachments) {
  const attachmentPaths = []
  const attachmentDir = process.env.ATTACHMENT_PATH || './attachments'

  if (!fs.existsSync(attachmentDir)) {
    fs.mkdirSync(attachmentDir, { recursive: true })
  }

  attachments.forEach((attachment) => {
    const filename = path.basename(attachment.filename)
    const attachmentPath = path.join(attachmentDir, filename)

    fs.writeFileSync(attachmentPath, attachment.content)
    attachmentPaths.push(attachmentPath)
  })

  return attachmentPaths
}

function buildRawMessage({ sender, recipient, subject, text, attachmentPaths }) {
  let message = ''
  const boundary = '----=_NodeMailerBoundary'

  const messageId = `<${Date.now()}-${Math.random().toString(36).substring(2)}@${sender.split('@')[1]}>`
  console.log(`Generated Message-ID: ${messageId}`)

  message += `From: ${sender}\r\n`
  message += `To: ${recipient}\r\n`
  message += `Subject: ${subject}\r\n`
  message += `Message-ID: ${messageId}\r\n`
  message += `MIME-Version: 1.0\r\n`

  if (attachmentPaths && attachmentPaths.length) {
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`
    message += `--${boundary}\r\n`
    message += `Content-Type: text/plain; charset="utf-8"\r\n`
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`
    message += `${text}\r\n\r\n`

    attachmentPaths.forEach((filePath) => {
      const filename = path.basename(filePath)
      const content = fs.readFileSync(filePath).toString('base64')
      const mimeType = getMimeType(filename)
      console.log(`MIME type for ${filename}: ${mimeType}`)

      message += `--${boundary}\r\n`;
      message += `Content-Type: ${mimeType}; name="${filename}"\r\n`
      message += `Content-Disposition: attachment; filename="${filename}"\r\n`
      message += `Content-Transfer-Encoding: base64\r\n\r\n`
      message += `${content}\r\n\r\n`
    });

    message += `--${boundary}--\r\n`
  } else {
    message += `Content-Type: text/plain; charset="utf-8"\r\n`
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`
    message += `${text}\r\n`
  }

  return message
}

function getMimeType(filename) {
  const extension = filename.split('.').pop().toLowerCase()
  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'pdf':
      return 'application/pdf'
    case 'txt':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}