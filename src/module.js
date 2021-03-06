import fs from 'fs'
import path from 'path'
import createServerLogger from './server'
import loggerMiddleware from './server-middleware'

const defaults = {
  clientLogger: path.resolve(__dirname, '../dist/client.js'),
  serverLogger: path.resolve(__dirname, 'server.js'),
}

export default function(moduleOptions) {
  const options = { ...this.options.logger, ...moduleOptions }
  const { client: clientOptions = {}, server: serverOptions = {} } = options

  delete options.client
  delete options.server

  const isProd = process.env.NODE_ENV === 'production'
  options.level = isProd ? 'info' : 'debug'
  clientOptions.factory = clientOptions.factory || defaults.clientLogger
  serverOptions.factory = serverOptions.factory || defaults.serverLogger
  serverOptions.logsDir = serverOptions.logsDir || '~/logs'
  serverOptions.logsPath = serverOptions.logsPath || '/logger/logs'
  if (typeof serverOptions.isEnableView === 'undefined') {
    serverOptions.isEnableView = !isProd
  }

  const srcPath = path.resolve(this.options.srcDir)
  const buildPath = path.resolve(this.options.buildDir)

  function convertToRelativePath(target, prop, from, to) {
    if (!path.isAbsolute(target[prop]) && !target[prop].startsWith('~')) {
      target[prop] = path.join('~', target[prop])
    }
    target[prop] = path.relative(from, target[prop].replace('~', to))
    target[prop] = target[prop].split(/[\\/]/g).join(path.posix.sep)
  }

  convertToRelativePath(clientOptions, 'factory', buildPath, srcPath)
  convertToRelativePath(serverOptions, 'factory', buildPath, srcPath)
  convertToRelativePath(serverOptions, 'logsDir', buildPath, srcPath)

  // fix absolute path
  serverOptions.logsDir = serverOptions.logsDir.startsWith('~')
    ? serverOptions.logsDir
    : path.join('~', serverOptions.logsDir)
  serverOptions.logsDir = path.relative(
    path.resolve(buildPath),
    path.resolve(serverOptions.logsDir.replace('~', this.options.buildDir)),
  )

  // create if logs directory is not exists
  if (!fs.existsSync(serverOptions.logsDir)) {
    fs.mkdirSync(serverOptions.logsDir)
  }

  // initialize default server logger
  createServerLogger({
    ...options,
    ...serverOptions,
  })

  // add server middleware
  this.options.serverMiddleware = this.options.serverMiddleware || []
  this.options.serverMiddleware.push({
    path: serverOptions.logsPath,
    handler: loggerMiddleware(serverOptions),
  })

  // register ready, close hooks
  const hooks = ['ready', 'close']
  hooks.forEach(hook => {
    this.nuxt.hook(hook, () => {
      global.$logger.info(`nuxt ${hook}.`)
    })
  })

  this.addPlugin({
    src: path.resolve(__dirname, 'plugin.template'),
    fileName: 'logger.client.js',
    ssr: false,
    options: {
      ...options,
      ...clientOptions,
    },
  })

  this.addPlugin({
    src: path.resolve(__dirname, 'plugin.template'),
    fileName: 'logger.server.js',
    ssr: true,
    options: {
      ...options,
      ...serverOptions,
    },
  })
}
