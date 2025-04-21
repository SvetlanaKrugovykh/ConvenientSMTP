const Service = require('node-windows').Service
const path = require('path');

const scriptPath = path.join(__dirname, 'index.js')

const svc = new Service({
  name: 'ConvenientSMTP',
  description: 'ConvenientSMTP - SMTP server for forwarding and processing emails.',
  script: scriptPath,
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
})

svc.on('install', () => {
  console.log('Service installed successfully!');
  svc.start()
})

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully!');
})

svc.on('error', (err) => {
  console.error('Service error:', err);
})

const action = process.argv[2]
if (action === 'install') {
  svc.install()
} else if (action === 'uninstall') {
  svc.uninstall()
} else {
  console.log('Usage: node windows-service.js install|uninstall')
}