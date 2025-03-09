// src/auth.js
module.exports = function (auth, session, callback) {
  console.log('onAuth called')
  if (auth.username === 'user' && auth.password === 'pass') {
    return callback(null, { user: 'userdata' })
  }
  return callback(new Error('Invalid username or password'))
}