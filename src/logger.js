const { createLogger, format, transports } = require('winston')
const { combine, timestamp, printf } = format

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`
})

const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    logFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/smtp-server.log' })
  ]
})

console.log = (message) => {
  logger.info(message)
}

console.error = (message) => {
  logger.error(message)
}

module.exports = logger