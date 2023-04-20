const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs-extra')
const ps = require('node:process')
const {ipfsGatewayPort, ipfsApiPort} = require('./settings')
if (!ipfsGatewayPort) {
  throw Error('missing settings.ipfsGatewayPort')
}
if (!ipfsApiPort) {
  throw Error('missing settings.ipfsApiPort')
}
const ipfsPath = require('go-ipfs').path()
const ipfsDataPath = path.resolve(__dirname, '.ipfs')
console.log(`IPFS_PATH=${ipfsDataPath} ${ipfsPath}`)

// use this custom function instead of spawnSync for better logging
// also spawnSync might have been causing crash on start on windows
const spawnAsync = (...args) =>
  new Promise((resolve, reject) => {
    const spawedProcess = spawn(...args)
    spawedProcess.on('exit', (exitCode, signal) => {
      if (exitCode === 0) resolve()
      else
        reject(
          Error(
            `spawnAsync process '${spawedProcess.pid}' exited with code '${exitCode}' signal '${signal}'`
          )
        )
    })
    spawedProcess.stderr.on('data', (data) => console.error(data.toString()))
    spawedProcess.stdin.on('data', (data) => console.log(data.toString()))
    spawedProcess.stdout.on('data', (data) => console.log(data.toString()))
    spawedProcess.on('error', (data) => console.error(data.toString()))
  })

const startIpfs = async () => {
  if (!fs.existsSync(ipfsPath)) {
    throw Error(`ipfs binary '${ipfsPath}' doesn't exist`)
  }

  fs.ensureDirSync(ipfsDataPath)
  const env = { IPFS_PATH: ipfsDataPath }
  // init ipfs client on first launch
  try {
    await spawnAsync(ipfsPath, ['init'], { env, hideWindows: true })
  } catch (e) {}

  // dont use 8080 port because it's too common
  await spawnAsync(ipfsPath, ['config', 'Addresses.Gateway', `/ip4/127.0.0.1/tcp/${ipfsGatewayPort}`], {
    env,
    hideWindows: true,
  })
  // dont use 5001 in case it's already in use
  await spawnAsync(ipfsPath, ['config', 'Addresses.API', `/ip4/127.0.0.1/tcp/${ipfsApiPort}`], {
    env,
    hideWindows: true,
  })

  await new Promise((resolve, reject) => {
    const ipfsProcess = spawn(
      ipfsPath,
      ['daemon', '--enable-pubsub-experiment', '--enable-namesys-pubsub'],
      { env, hideWindows: true }
    )
    console.log(`ipfs daemon process started with pid ${ipfsProcess.pid}`)
    let lastError
    ipfsProcess.stderr.on('data', (data) => {
      lastError = data.toString()
      console.error(data.toString())
    })
    ipfsProcess.stdin.on('data', (data) => console.log(data.toString()))
    ipfsProcess.stdout.on('data', (data) => console.log(data.toString()))
    ipfsProcess.on('error', (data) => console.error(data.toString()))
    ipfsProcess.on('exit', () => {
      console.error(`ipfs process with pid ${ipfsProcess.pid} exited`)
      reject(Error(lastError))
    })
    process.on('exit', () => {
      try {
        ps.kill(ipfsProcess.pid)
      } catch (e) {
        console.log(e)
      }
      try {
        // sometimes ipfs doesnt exit unless we kill pid +1
        ps.kill(ipfsProcess.pid + 1)
      } catch (e) {
        console.log(e)
      }
    })

    // daemon is ready
    ipfsProcess.stdout.on("data", (data) => {
      if (data.toString().match("Daemon is ready")) {
        resolve()
      }
    })
  })
}

module.exports = startIpfs
