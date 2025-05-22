const { forwardingRules } = require('./config')
const logger = require('./logger')
require('dotenv').config()

module.exports = function (auth, session, callback) {
  logger.info('onAuth called')
  logger.info('Auth data:', auth)

  if (forwardingRules.relayPassIPs.includes(session.remoteAddress)) {
    logger.info('Trusted IP, authentication bypassed (auth)')
    return callback(null, { user: process.env.DEFAULT_USER })
  }

  const user = forwardingRules.users.find(
    u => u.username === auth.username && u.password === auth.password
  )

  if (user) {
    logger.info('Authentication successful')
    return callback(null, { user: user.username })
  }

  logger.warn('Authentication failed')
  return callback(new Error('Invalid username or password'))
}