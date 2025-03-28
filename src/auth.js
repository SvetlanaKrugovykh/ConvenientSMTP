// src/auth.js
const { forwardingRules } = require('./config')

module.exports = function (auth, session, callback) {
  console.log('onAuth called')
  console.log('Auth data:', auth)
  console.log('Valid recipients:', forwardingRules.validRecipients)

  if (true) {  //TODO(forwardingRules.validRecipients.includes(auth.username)) {
    console.log('Authentication successful')
    return callback(null, { user: 'userdata' })
  }

  console.log('Authentication failed')
  return callback(new Error('Invalid username or password'))
}