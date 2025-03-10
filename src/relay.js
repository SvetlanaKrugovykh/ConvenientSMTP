const { PassThrough } = require('stream')
const logger = require('./logger')

module.exports = function (stream, session, callback, forwardingRules, server) {
  const recipient = session.envelope.rcptTo[0].address.trim()
  const sender = session.envelope.mailFrom.address.trim()
  let emailBody = ''

  console.log('Checking recipient:', recipient)
  console.log('Checking sender:', sender)

  if (!forwardingRules.validRecipients.map(e => e.trim()).includes(recipient)) {
    console.log('Recipient is not allowed')
    return callback(new Error('Recipient is not allowed'))
  }

  if (forwardingRules.blacklist.map(e => e.trim()).includes(sender)) {
    console.log('Sender is blacklisted')
    return callback(new Error('Sender is blacklisted'))
  }

  if (forwardingRules.rules[recipient]) {
    forwardingRules.rules[recipient].forEach(forwardAddress => {
      console.log(`Forwarding email to ${forwardAddress}`)

      const forwardStream = new PassThrough()
      stream.pipe(forwardStream)

      const forwardSession = {
        envelope: {
          mailFrom: session.envelope.mailFrom,
          rcptTo: [{ address: forwardAddress }]
        }
      }

      server.onData(forwardStream, forwardSession, (err) => {
        if (err) {
          logger.error('Error forwarding email: ' + err.message)
          return
        }
        logger.info('Email forwarded to ' + forwardAddress)
      })
    })
  }

  stream.on('data', (chunk) => {
    emailBody += chunk.toString()
  })

  stream.pipe(process.stdout)

  stream.on('end', async () => {
    const to = session.envelope.rcptTo[0].address
    const from = session.envelope.mailFrom.address
    console.log(`Received email from ${from} to ${to}`)
    console.log(`Email body: ${emailBody}`)

    await saveEmail(to, from, 'No Subject', emailBody, []) // Save email to database WITHOUT attachments!!! //TODO

    callback()
  })
}