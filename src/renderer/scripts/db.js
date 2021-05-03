const { app, remote } = require('electron')
const Datastore = require('nedb-promises')

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

const config = dbFactory('config.db')

export const setConfig = (key, value) => {
  return config.update({ key }, { key, value }, { upsert: true })
}

export const getConfig = (key, def = null) => {
  return config.find({ key }).then(([conf]) => conf ? conf.value : def)
}

export const getOrSetConfig = (key, def = null) => {
  return config.find({ key })
    .then(([conf]) => conf ? conf.value : null)
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

const LinvoDB = require('linvodb3')

LinvoDB.defaults.store = { db: require('level-js') } // Comment out to use LevelDB instead of level-js
LinvoDB.dbPath = filePath

export function createDb (name, schema = {}) {
  const Doc = new LinvoDB(name, schema)

  return Doc
}
