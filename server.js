const { SMTPServer } = require('smtp-server')
const config = require('./src/config')
const logger = require('./src/logger')
const fs = require('fs')
const path = require('path')
const auth = require('./src/auth')
const relay = require('./src/relay')
require('dotenv').config()
const updateTables = require('./db/tablesUpdate').updateTables

try {
  updateTables()
} catch (err) {
  console.log(err)
}

const blacklist = fs
  .readFileSync(path.join(__dirname, './config', 'blacklist.txt'), 'utf-8')
  .split('\n')
  .map(email => email.trim())
  .filter(Boolean)

const allowedRelayIPs = fs
  .readFileSync(path.join(__dirname, './config', 'allowed_ips.txt'), 'utf-8')
  .split('\n')
  .map(ip => ip.trim())
  .filter(Boolean)

const validRecipients = fs
  .readFileSync(path.join(__dirname, './config', 'rcpt_to.in_host_list'), 'utf-8')
  .split('\n')
  .map(email => email.trim())
  .filter(Boolean)

console.log('Allowed relay IPs:', allowedRelayIPs)
console.log('Blacklist:', blacklist)
console.log('Valid recipients:', validRecipients)


const forwardingRules = {
  blacklist,
  allowedRelayIPs,
  validRecipients,
  rules: require('./config/forwarding-rules')
}

function handleOnData(stream, session, callback) {
  console.log('onData called')
  relay(stream, session, callback, forwardingRules, this)
  stream.on('end', () => callback())
}


function handleOnAuth(authData, session, callback) {
  console.log('onAuth called')
  auth(authData, session, callback)
}

function handleOnConnect(session, callback) {
  console.log('onConnect called')
  callback()
}

function handleOnMailFrom(address, session, callback) {
  console.log('onMailFrom called')
  console.log(`Client IP: ${session.remoteAddress}`)
  if (!forwardingRules.allowedRelayIPs.includes(session.remoteAddress)) {
    console.log('IP not allowed for relay')
    return callback(new Error('IP not allowed for relay'))
  }
  callback()
}

function startServer() {
  const server = new SMTPServer({
    onData: handleOnData,
    onAuth: handleOnAuth,
    onConnect: handleOnConnect,
    onMailFrom: handleOnMailFrom,
    logger: true,
    disabledCommands: ['STARTTLS'],
  })

  server.listen(config.port, () => {
    logger.info('SMTP server started on port ' + config.port)
  })

  server.on('error', (err) => {
    logger.error('Server ERROR: ' + err.message)
  })
}

startServer()