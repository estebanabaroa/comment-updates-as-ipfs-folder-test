require('util').inspect.defaultOptions.depth = process.env.DEBUG_DEPTH
const { randomBytes } = require('crypto')
const fs = require('fs')
const {createGenerator} = require('ipfs-cid')
const {BufferGenerator} = require('ipfs-cid/extensions/buffer')
const startIpfs = require('./start-ipfs')
const {ipfsApiPort} = require('./settings')
const IpfsHttpClient = require('ipfs-http-client')
const ipfsClient = IpfsHttpClient.create({url: `http://localhost:${ipfsApiPort}/api/v0`})
const prettyBytes = require('pretty-bytes')
const getSize = require('get-folder-size')
const path = require('path')
const ipfsDataPath = path.resolve(__dirname, '.ipfs')

const subplebbitAddress ='mysub.eth'

;(async () => {
  await startIpfs()
  add()
})()

const add = async () => {
  let count = 0
  while (count++ < 100000) {
    try {
      const commentUpdate = await generateRandomCommentUpdate()
      const data = {
        path: `/${subplebbitAddress}/commentUpdates/${commentUpdate.cid}`,
        content: JSON.stringify(commentUpdate)
      }
      const before = Date.now()
      await ipfsClient.files.write(data.path, data.content, {parents: true, truncate: true, create: true})
      const time = Date.now() - before
      console.log(`${count}: added ${commentUpdate.cid} in ${time}ms`)
      if (count % 1000 === 0) {
        const folder = await ipfsClient.files.stat(`/${subplebbitAddress}/commentUpdates`)
        const size = await getFolderSize(ipfsDataPath)
        console.log(`total ${prettyBytes(folder.cumulativeSize)} ${prettyBytes(size)}`)
      }
    }
    catch (e) {
      console.log(e)
    }
  }
}

const getFolderSize = (path) => new Promise((resolve, reject) => {
  getSize(path, (err, size) => {
    if (err) { return reject(err) }
    resolve(size)
  })
})

const generateRandomCommentUpdate = async () => {
  const commentUpdate = {
    upvoteCount: 2345,
    downvoteCount: 2345,
    replyCount: 45,
    updatedAt: 24363456234,
    protocolVersion: '1.0.0',
    signature: {
      publicKey: "a0hMPtIEVbJ4ge1+CktJa2J9gFfIUkdjsRRYbYxEvX8",
      signature: "1r2c49nDyNhwMazsi8QY8Icb7cAjh+7W17wXobLUfDvgt2bWOjBuaMWHUbKaZGiSay9TQT/JK3cSFF4zzJHpBA",
      signedPropertyNames: ["subplebbitAddress","author","timestamp","content","title","link","parentCid"],
      type: "ed25519"
    },
    author: {
      subplebbit: {
        postScore: 2345,
        replyScore: 2345,
        lastCommentCid: 'QmZXkK7aycVrEiPC94h89xx2wmeMfLWWLgFEgThMQQ1HW9',
        firstCommentTimestamp: 234562345523
      }
    },
    cid: await generateRandomCid()
  }
  return commentUpdate
}

const generateRandomCid = async () => {
  const content = randomBytes(32).toString('base64')
  fs.writeFileSync('./tmp', content)
  const generator = createGenerator();
  generator.mount(BufferGenerator.createInstance())
  const fileStream = fs.createReadStream('./tmp')
  const cid = await generator.generate(fileStream)
  return cid.toString()
}
