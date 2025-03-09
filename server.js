// server.js
const { SMTPServer } = require('smtp-server')
require('dotenv').config()
const config = require('./src/config')
const logger = require('./src/logger')

function startServer() {
  const server = new SMTPServer({
    onData(stream, session, callback) {
      stream.pipe(process.stdout) // Print message to console
      stream.on('end', callback)
    },
    onAuth(auth, session, callback) {
      if (auth.username === 'user' && auth.password === 'pass') {
        return callback(null, { user: 'userdata' })
      }
      return callback(new Error('Invalid username or password'))
    }
  })

  server.listen(config.port, () => {
    logger.info('SMTP server started on port ' + config.port)
  })

  server.on('error', (err) => {
    logger.error('Server ERROR: ' + err.message)
  })
}

startServer()


