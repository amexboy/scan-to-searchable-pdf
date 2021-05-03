const path = require('path')
const { app, remote } = require('electron')

const Datastore = require('nedb-promises')
const LinvoDB = require('linvodb3')
const LevelJs = require('level-js')

const options = { store: { db: LevelJs }, autoIndexing: true, autoLoad: true }

const datastores = {}
const isDev = process.env.NODE_ENV === 'development'
const filePath = `${isDev ? '.' : (app || remote.app).getPath('home')}/searchable-pdf-data`

export const dbFactory = fileName => {
  if (datastores[fileName]) {
    console.log(`Returning a singlton for ${fileName}`)
    return datastores[fileName]
  }

  const datastore = Datastore.create({
    filename: `${filePath}/${fileName}`,
    timestampData: true,
    autoload: true
  })
  datastores[fileName] = datastore
  return datastore
}

export function createDb (name, schema) {
  const dbPath = path.resolve(`${filePath}/${name}.db`)
  if (datastores[dbPath]) {
    console.log(`Returning a singlton for ${dbPath}`)
    return datastores[dbPath]
  }

  console.log('Database store path', dbPath)
  const Doc = new LinvoDB(name, schema, {
    filename: dbPath,
    ...options
  })
  datastores[dbPath] = Doc

  return Doc
}

const config = dbFactory('config.db')

export function resolver (resolve, reject) {
  return (err, docs) => err ? reject(err) : resolve(docs)
}

export const setConfig = (key, value) => {
  return config.update({ key }, { key, value }, { upsert: true })
}

export const getConfig = (key, def = null) => {
  return config.find({ key }).then(([conf]) => conf ? conf.value : def)
}

export const getOrSetConfig = (key, def = null) => {
  return getConfig(key)
    .then(res => {
      if (res == null) {
        return setConfig(key, def).then(_ => def)
      }
      return res
    })
}

export const getCredential = async () => {
  const [apiKeyId, apiKeySecret, region] = await Promise.all(['apiKeyId', 'apiKeySecret', 'region'].map(getConfig))
  const credentials = apiKeyId && apiKeySecret ? { accessKeyId: apiKeyId, secretAccessKey: apiKeySecret } : null

  return { region: region || 'us-east-1', credentials }
}

export const setAwsAccess = (apiKeyId, apiKeySecret, region) => {
  return Promise.all([
    setConfig('apiKeyId', apiKeyId),
    setConfig('apiKeySecret', apiKeySecret),
    setConfig('region', region)
  ])
}
