const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  user: process.env.PAY_DB_USER,
  host: process.env.PAY_DB_HOST,
  database: process.env.PAY_DB_NAME,
  password: process.env.PAY_DB_PASSWORD,
  port: process.env.PAY_DB_PORT,
})

const tableNames = ['users', 'emails', 'attachments']

const tableQueries = {
  'users': `
    CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`,
  'emails': `
    CREATE TABLE emails (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    from_email VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    subject TEXT,
    body TEXT,
    received_at TIMESTAMP DEFAULT now(),
    folder VARCHAR(50) DEFAULT 'inbox'
    )`,
  'attachments': `
    CREATE TABLE attachments (
      id SERIAL PRIMARY KEY,
      email_id INT REFERENCES emails(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL
    )`
}


module.exports.updateTables = function () {
  checkAndCreateTable('users')
    .then(() => checkAndCreateTable('emails'))
    .then(() => checkAndCreateTable('attachments'))
    .then(() => {
      console.log('All tables created or already exist.')
    })
    .catch((err) => {
      console.error('Error in table creation sequence:', err)
    })
}


function checkAndCreateTable(tableName) {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = $1
      )`,
      [tableName],
      (err, res) => {
        if (err) {
          console.error(`Error checking if table ${tableName} exists:`, err)
          reject(err)
          return
        }
        const tableExists = res.rows[0].exists
        if (!tableExists) {
          createTable(tableName).then(resolve).catch(reject)
        } else {
          console.log(`Table ${tableName} already exists.`)
          resolve()
        }
      }
    )
  })
}



function createTable(tableName) {
  return new Promise((resolve, reject) => {
    const query = tableQueries[tableName]
    if (!query) {
      console.error(`No query found for table ${tableName}`)
      reject(new Error(`No query found for table ${tableName}`))
      return
    }

    pool.query(query, (err, res) => {
      if (err) {
        console.error(`Error creating table ${tableName}:`, err)
        reject(err)
      } else {
        console.log(`Table ${tableName} created successfully.`)
        resolve()
      }
    })
  })
}