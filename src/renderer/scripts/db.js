const { app, remote } = require('electron')
const Datastore = require('nedb-promises')

const datastores = {}

export const dbFactory = fileName => {
  if (datastores[fileName]) {
    console.log(`Returning a singlton for ${fileName}`)
    return datastores[fileName]
  }

  const filePath = process.env.NODE_ENV === 'development' ? '.' : (app || remote.app).getPath('home')
  const datastore = Datastore.create({
    filename: `${filePath}/searchable-pdf-data/${fileName}`,
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
