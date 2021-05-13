import { CryptoProvider, PublicClientApplication } from '@azure/msal-node'
import { setConfig } from './db'

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
  const window = createAuthWindow()

  const request = { scopes: ['Files.ReadWrite.All'] }
  const account = await getAccount()
  console.log('Cached account', account)

  let response
  if (account) {
    response = getTokenSilent(window, { account, ...request })
  } else {
    response = getTokenInteractive(window, request)
  }

  return response
    .then(cred => {
      setConfig('onedrive_auth', cred)
      return cred
    })
    .finally(_ => window.close())
}

async function getTokenSilent (authWindow, tokenRequest) {
  try {
    return await pca.acquireTokenSilent(tokenRequest)
  } catch (error) {
    console.log('Silent token acquisition failed, acquiring token using pop up')
    const authCodeRequest = { ...this.authCodeUrlParams, ...tokenRequest }
    return getTokenInteractive(authWindow, authCodeRequest)
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
export async function getTokenInteractive (authWindow, tokenRequest) {
  /**
     * Proof Key for Code Exchange (PKCE) Setup
     *
     * MSAL enables PKCE in the Authorization Code Grant Flow by including the codeChallenge and codeChallengeMethod
     * parameters in the request passed into getAuthCodeUrl() API, as well as the codeVerifier parameter in the
     * second leg (acquireTokenByCode() API).
     */

  const { verifier, challenge } = await cryptoProvider.generatePkceCodes()

  pkceCodes.verifier = verifier
  pkceCodes.challenge = challenge

  const authCodeUrlParams = {
    redirectUri,
    scopes: tokenRequest.scopes,
    codeChallenge: pkceCodes.challenge, // PKCE Code Challenge
    codeChallengeMethod: pkceCodes.challengeMethod // PKCE Code Challenge Method
  }

  const authCodeUrl = await pca.getAuthCodeUrl(authCodeUrlParams)

  // register the custom file protocol in redirect URI
  //   protocol.registerFileProtocol(redirectUri.split(':')[0], (req, callback) => {
  //     const requestUrl = url.parse(req.url, true)
  //     callback(path.normalize(`${__dirname}/${requestUrl.path}`))
  //   })

  const authCode = await listenForAuthCode(authCodeUrl, authWindow) // see below

  const authResponse = await pca.acquireTokenByCode({
    redirectUri,
    scopes: tokenRequest.scopes,
    code: authCode,
    codeVerifier: pkceCodes.verifier // PKCE Code Verifier
  })

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
