import { CryptoProvider, PublicClientApplication } from '@azure/msal-node'
import axios from 'axios'
import { setConfig, getConfig } from './db'

const { BrowserWindow } = require('electron').remote
// import { app, BrowserWindow, ipcMain } from 'electron'

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
  console.log('Cached account', account)

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
    const authCodeRequest = { ...this.authCodeUrlParams, ...tokenRequest }
    return getTokenInteractive(authCodeRequest)
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
const apiUrl = async (path, resource) => {
  const base = await getConfig('onedrive_root', 'root')

  return `https://graph.microsoft.com/v1.0/${base}${path ? ':/' + path : ''}${resource ? ':/' + resource : ''}`
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
  const url = await apiUrl(path)
  const token = await getToken()
  const headers = {
    headers: {
      'Authorization': `Bearer ${token.accessToken}`
    }
  }

  return axios.get(url, headers)
    .then(res => {
      console.log('Response', res)
      return res.data['@microsoft.graph.downloadUrl']
    })
    .then(downloadUrl => axios.get(downloadUrl))
    .then(result => result.data)
}

export async function setJson (path, data) {
  const url = await apiUrl(path, 'content')
  const token = await getToken()
  const headers = {
    headers: {
      'Authorization': `Bearer ${token.accessToken}`
    }
  }

  return axios.put(url, data, headers)
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
