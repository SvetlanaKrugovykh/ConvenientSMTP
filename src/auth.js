const { forwardingRules } = require('./config')
require('dotenv').config()

module.exports = function (auth, session, callback) {
  console.log('onAuth called')
  console.log('Auth data:', auth)

  if (forwardingRules.relayPassIPs.includes(session.remoteAddress)) {
    console.log('Trusted IP, authentication bypassed')
    return callback(null, { user: process.env.DEFAULT_USER })
  }

  const user = forwardingRules.users.find(
    u => u.username === auth.username && u.password === auth.password
  )

  if (user) {
    console.log('Authentication successful')
    return callback(null, { user: user.username })
  }

  console.log('Authentication failed')
  return callback(new Error('Invalid username or password'))
}