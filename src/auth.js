const { forwardingRules } = require('./config')

module.exports = function (auth, session, callback) {
  console.log('onAuth called')
  console.log('Auth data:', auth)

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