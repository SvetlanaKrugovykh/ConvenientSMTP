const dns = require('dns').promises
const SMTPConnection = require('smtp-connection')
const fs = require('fs')
const logger = require('./logger')

async function sendDirectSMTP(letterData) {
  const { to, from, subject, text, attachmentPaths } = letterData

  const domain = to.split('@')[1]
  logger.info(`Resolving MX for domain: ${domain}`)

  let mxRecords
  try {
    mxRecords = await dns.resolveMx(domain)
  } catch (err) {
    logger.error('Failed to resolve MX:', err)
    throw err
  }

  mxRecords.sort((a, b) => a.priority - b.priority)
  const targetMX = mxRecords[0].exchange

  logger.info(`Using MX server: ${targetMX}`)

  const connection = new SMTPConnection({
    host: targetMX,
    port: 25,
    tls: { rejectUnauthorized: false },
  })

  await new Promise((resolve, reject) => {
    connection.connect(() => {
      logger.info('Connected to target MX')
      resolve()
    })
    connection.on('error', reject)
  })

  const envelope = { from, to }

  await new Promise((resolve, reject) => {
    connection.send(envelope, buildRawMessage({ from, to, subject, text, attachmentPaths }), (err, info) => {
      if (err) return reject(err)
      logger.info('Mail sent:', info)
      resolve(info)
    })
  })

  connection.quit()
}

function buildRawMessage({ from, to, subject, text, attachmentPaths }) {
  let message = ''
  const boundary = '----=_NodeMailerBoundary'

  message += `From: ${from}\r\n`
  message += `To: ${to}\r\n`
  message += `Subject: ${subject}\r\n`
  message += `MIME-Version: 1.0\r\n`
  if (attachmentPaths && attachmentPaths.length) {
    message += `Content-Type: multipart/mixed; boundary=${boundary}\r\n\r\n`
    message += `--${boundary}\r\nContent-Type: text/plain\r\n\r\n${text}\r\n`
    attachmentPaths.forEach((filePath) => {
      const filename = filePath.split('/').pop()
      const content = fs.readFileSync(filePath).toString('base64')
      message += `\r\n--${boundary}\r\n`
      message += `Content-Type: application/octet-stream; name="${filename}"\r\n`
      message += `Content-Disposition: attachment; filename="${filename}"\r\n`
      message += `Content-Transfer-Encoding: base64\r\n\r\n${content}\r\n`
    })
    message += `--${boundary}--`
  } else {
    message += `Content-Type: text/plain\r\n\r\n${text}\r\n`
  }

  return message
}

module.exports = { sendDirectSMTP }
