import { CryptoProvider, PublicClientApplication } from '@azure/msal-node'
import axios from './axios'
import { setConfig, getConfig } from './db'

const { gzip, gunzip } = require('zlib')
const { BrowserWindow } = require('electron').remote

const MSAL_CONFIG = {
  auth: {
    clientId: 'a9aee712-bda8-46d9-914d-b78a1b13f004'
  }
}

const pca = new PublicClientApplication(MSAL_CONFIG)
const cryptoProvider = new CryptoProvider()

const redirectUri = 'http://localhost' // 'msal://redirect'

const pkceCodes = {
  challengeMethod: 'S256', // Use SHA256 Algorithm
  verifier: '', // Generate a code verifier for the Auth Code Request first
  challenge: '' // Generate a code challenge from the previously generated code verifier
}

function createAuthWindow () {
  return new BrowserWindow({
    width: 400,
    height: 600
  })
}

export async function getToken () {
  const request = { scopes: ['Files.ReadWrite.All', 'Sites.Read.All'] }
  const account = await getAccount()

  let response
  if (account) {
    response = getTokenSilent({ account, ...request })
  } else {
    response = getTokenInteractive(request)
  }

  return response
    .then(cred => {
      setConfig('onedrive_auth', cred)
      return cred
    })
}

async function getTokenSilent (tokenRequest) {
  try {
    return await pca.acquireTokenSilent(tokenRequest)
  } catch (error) {
    console.log('Silent token acquisition failed, acquiring token using pop up')
    return getTokenInteractive(tokenRequest)
  }
}

async function getAccount () {
  // need to call getAccount here?
  const cache = pca.getTokenCache()
  const currentAccounts = await cache.getAllAccounts()

  if (currentAccounts === null) {
    console.log('No accounts detected')
    return null
  }

  if (currentAccounts.length > 1) {
    // Add choose account code here
    console.log('Multiple accounts detected, need to add choose account code.')
    return currentAccounts[0]
  } else if (currentAccounts.length === 1) {
    return currentAccounts[0]
  } else {
    return null
  }
}

/**
 * Starts an interactive token request
 * @param {object} authWindow: Electron window object
 * @param {object} tokenRequest: token request object with scopes
 */
export async function getTokenInteractive (tokenRequest) {
  /**
     * Proof Key for Code Exchange (PKCE) Setup
     *
     * MSAL enables PKCE in the Authorization Code Grant Flow by including the codeChallenge and codeChallengeMethod
     * parameters in the request passed into getAuthCodeUrl() API, as well as the codeVerifier parameter in the
     * second leg (acquireTokenByCode() API).
     */

  const { verifier, challenge } = await cryptoProvider.generatePkceCodes()
  const authWindow = createAuthWindow()

  pkceCodes.verifier = verifier
  pkceCodes.challenge = challenge

  const authCodeUrlParams = {
    redirectUri,
    scopes: tokenRequest.scopes,
    codeChallenge: pkceCodes.challenge, // PKCE Code Challenge
    codeChallengeMethod: pkceCodes.challengeMethod // PKCE Code Challenge Method
  }

  const authCodeUrl = await pca.getAuthCodeUrl(authCodeUrlParams)

  const authCode = await listenForAuthCode(authCodeUrl, authWindow) // see below

  const authResponse = await pca.acquireTokenByCode({
    redirectUri,
    scopes: tokenRequest.scopes,
    code: authCode,
    codeVerifier: pkceCodes.verifier // PKCE Code Verifier
  })
  authWindow.close()

  return authResponse
}

/**
 * Listens for auth code response from Azure AD
 * @param {string} navigateUrl: URL where auth code response is parsed
 * @param {object} authWindow: Electron window object
 */
async function listenForAuthCode (navigateUrl, authWindow) {
  authWindow.loadURL(navigateUrl)

  return new Promise((resolve, reject) => {
    authWindow.webContents.on('will-redirect', (event, responseUrl) => {
      try {
        const parsedUrl = new URL(responseUrl)
        const authCode = parsedUrl.searchParams.get('code')
        console.log('Resonponse auth code', authCode)
        if (authCode) {
          resolve(authCode)
        }
      } catch (err) {
        reject(err)
      }
    })
  })
}

const apiResourceUri = async (path, resource) => {
  const base = await getConfig('onedrive_root', 'root')

  return `/${base}${path ? ':/' + path : ''}${resource ? ':/' + resource : ''}`
}

const apiUrl = async (path, resource) => {
  const uri = await apiResourceUri(path, resource)

  return `https://graph.microsoft.com/v1.0${uri}`
}

export async function list (path) {
  const url = await apiUrl(path, 'children')
  const token = await getToken()
  const headers = {
    headers: {
      'Authorization': `Bearer ${token.accessToken}`
    }
  }

  return axios.get(url, headers)
    .then(res => {
      console.log('Response', res)
      return res.data.value
    })
}

export async function getJson (path) {
  const url = await apiUrl(path, 'content')
  const token = await getToken()
  const headers = {
    headers: {
      'Authorization': `Bearer ${token.accessToken}`
    },
    responseType: 'arraybuffer'
  }

  return axios.get(url, headers)
    .then(async result => {
      const firstChar = new Int8Array(result.data)[0]

      if (['['.charCodeAt(0), '{'.charCodeAt(0)].includes(firstChar)) {
        return JSON.parse(new TextDecoder('utf-8').decode(result.data))
      }

      const unzipped = await new Promise((resolve, reject) =>
        gunzip(result.data, (err, res) => err ? reject(err) : resolve(res)))
        .then(res => JSON.parse(res))

      console.log('Unzipped Response', unzipped)
      return unzipped
    })
}

export async function getJsonBatch (paths) {
  return Promise.all(paths.map(getJson))
}

// export async function getJsonBatch (paths) {
//   const url = 'https://graph.microsoft.com/v1.0/$batch'

//   const token = await getToken()
//   const headers = {
//     headers: {
//       'Authorization': `Bearer ${token.accessToken}`
//     }
//   }
//   const requests = await Promise.all(
//     paths.map(async p => ({ id: p, method: 'GET', url: await apiResourceUri(p, 'content') })))

//   const data = { requests }
//   console.log('Batch request', data)

//   return axios.post(url, data, headers)
//     .then(async result => {
//       console.log(result)
//       return result.data
//     })
// }

export async function setJson (path, data, compress) {
  const url = await apiUrl(path, 'content')
  const token = await getToken()

  let upload = data
  if (compress) {
    const json = JSON.stringify(data)
    const buffer = Buffer.from(json)

    upload = await new Promise((resolve, reject) => gzip(buffer, (err, res) => err ? reject(err) : resolve(res)))
  }

  const headers = {
    headers: {
      'Authorization': `Bearer ${token.accessToken}`
    }
  }

  return axios.put(url, upload, headers)
    .then(res => {
      console.log('Response', res)
      return res
    })
}

export async function deleteFile (path) {
  const url = await apiUrl(path)
  const token = await getToken()
  const headers = {
    headers: {
      'Authorization': `Bearer ${token.accessToken}`
    }
  }

  return axios.delete(url, headers)
    .then(res => {
      console.log('Response', res)
      return res
    })
}
export async function deleteFiles (files) {
  return Promise.all(files.map(deleteFile))
}
