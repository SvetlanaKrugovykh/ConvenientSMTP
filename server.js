// server.js
const Haraka = require('haraka')
const path = require('path')
const config = require('./src/config')
const logger = require('./src/logger')

function startServer() {
  const server = new Haraka.Server()

  server.load_config(path.join(__dirname, 'config'))

  server.listen(config.port, function () {
    logger.info('SMTP сервер запущен на порту ' + config.port)
  })

  server.on('error', function (err) {
    logger.error('Ошибка сервера: ' + err.message)
  })
}

startServer()


