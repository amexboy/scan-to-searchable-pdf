
import fs from 'fs'
import { dirname, resolve } from 'path'
import { generateResult } from '@/scripts/process_file'
import { getMetadataPrefix, getMetadataKey } from './aws'
import { list, getToken, setJson, getJson, deleteFiles } from './onedrive'
import { resolver, createDb, getOrSetConfig } from './db'
const { app, remote } = require('electron')

const flagStore = createDb('flags', { fileKey: { type: String, index: true } })
const resultStore = createDb('results', { fileKey: { type: String, index: true } })

const FLAGS_KEY = filePath => getMetadataKey('flags/words', filePath)
const FLAGGED_SUMMARY_KEY = filePath => getMetadataKey('flags/summary', filePath)
const CORRECTIONS_KEY = filePath => getMetadataKey('flags/corrections', filePath)
const FLAGGED_SUMMARY_PREFIX = getMetadataPrefix('flags/summary')
const SAVED_RESULT_KEY = filePath => getMetadataKey('flags/results', filePath)

export const flagForReview = async (filePath, flags, pages, extras) => {
  const flaggsKey = FLAGS_KEY(filePath)
  const summaryKey = FLAGGED_SUMMARY_KEY(filePath)
  const pagesKey = SAVED_RESULT_KEY(filePath)

  const uploadResult = await getToken().then(_ => Promise.all([

    setJson(summaryKey, {
      extras,
      path: filePath,
      flagsCount: flags.length
    }),

    setJson(flaggsKey, flags),

    setJson(pagesKey, pages)
  ]))

  console.log('Flags uploaded succesfully', uploadResult)

  return uploadResult
}

export const getFlagedFiles = async () => {
  const files = await list(FLAGGED_SUMMARY_PREFIX)
    .catch(err => {
      console.log(err)
      return []
    })

  console.log('Flagged objects', files)

  return Promise.all(
    files.map(f => f.name)
      .map(key => getJson(`${FLAGGED_SUMMARY_PREFIX}/${key}`)))
}

export const getStoredResult = async filePath => {
  const fileKey = SAVED_RESULT_KEY(filePath)
  console.log('Stored result fileKey', fileKey)

  const storedPages = await new Promise(resolve => resultStore.find({ fileKey }, resolver(resolve)))
  const storedFlags = await getFlags(filePath)

  if (storedPages.length > 0 && storedPages[0].pages.length > 0) {
    return { pages: storedPages[0].pages, flagged: storedFlags }
  }

  const pages = await getJson(fileKey).catch(_ => null) //, credentials, bucketName)

  console.log('Found pages', pages)

  if (pages) {
    resultStore.update({ fileKey }, { fileKey, pages }, { upsert: true })

    return { pages }
  }
  return null
}

export async function getCorrections (filePath) {
  const correctionsKey = CORRECTIONS_KEY(filePath)

  const corrections = await getJson(correctionsKey).catch(_ => [])

  return corrections
}

export async function getFlags (filePath) {
  const fileKey = FLAGS_KEY(filePath)

  const stored = await new Promise(resolve => flagStore.find({ fileKey }, resolver(resolve)))
  console.log('Cached flags', stored)
  if (stored.length > 0 && stored[0].flags.length > 0) {
    return stored[0].flags
  }

  const result = await getJson(fileKey).catch(_ => [])
  console.log('Flags for file', result)

  flagStore.update({ fileKey }, { fileKey, flags: result }, { upsert: true })
  return result
}

function getCacheFile (filePath) {
  const resultKey = getMetadataKey('result', filePath, 'pdf')
  const rootPath = process.env.NODE_ENV === 'development' ? '.' : (app || remote.app).getPath('home')
  return resolve(`${rootPath}/results/${resultKey}`)
}

export async function getFlaggedWords (filePath, originalPath) {
  const corrections = await getCorrections(filePath)

  const cacheFile = getCacheFile(filePath)

  await fs.promises.mkdir(dirname(cacheFile), { recursive: true }).catch(_ => false)
  const cached = await fs.promises.access(cacheFile).then(_ => true).catch(_ => false)
  console.log('File cached check ', cached, cacheFile)
  if (!cached) {
    const result = await getStoredResult(filePath)

    await generateResult(originalPath || filePath, null, cacheFile, result)
      .then(_ => {
        console.log('Regenerated output file', _)
      })
  }

  const words = await getFlags(filePath)

  return { words, corrections, cacheFile }
}

export async function approveWords (filePath, pending) {
  const corrections = await getCorrections(filePath)
  const listToApprove = [
    ...corrections,
    ...pending.map(w =>
      ({ wordId: w.word.Id, newWord: w.newWord }))
  ]
  console.log('Approving/Correcting list', listToApprove)

  // uploading to s3
  const fileKey = CORRECTIONS_KEY(filePath)
  const uploadResult = await setJson(fileKey, listToApprove)
  console.log('Corrections uploaded succesfully', uploadResult)

  return uploadResult
}

export async function unlock (file) {
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))
  const fileKey = getMetadataKey('lock', file)

  console.log('Checking if lock exists for ', appId, fileKey)

  const lock = await getLock(file)

  if (!lock.hasLock) {
    return { success: true }
  }

  console.log('Going to release lock', appId)

  const lockStatus = await setJson(fileKey, {})
    .then(upload => {
      return true
    })
    .catch(_ => false)

  return lockStatus ? { success: true } : { success: false }
}

export async function getLock (file) {
  const fileKey = getMetadataKey('lock', file)
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))

  const appWithLock = await getJson(fileKey)
    .then(res => {
      return res.appId
    })
    .catch(_ => {
      console.log('Maybe', _)
      return null
    })

  console.log('App with lock', { appWithLock, locked: !!appWithLock, hasLock: appId === appWithLock })
  return { locked: !!appWithLock, hasLock: appId === appWithLock }
}

export async function hasLock (file) {
  const lock = await getLock(file)

  return lock.hasLock
}

export const lock = async (file, force = false) => {
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))
  const fileKey = getMetadataKey('lock', file)

  console.log('Checking if lock exists for ', appId, fileKey)

  const lock = force ? false : await getLock(file)

  if (lock.hasLock) {
    return { success: true }
  } else if (lock.locked && !force) {
    return { success: false }
  }

  console.log('Going to aquire lock', force, appId)

  const lockStatus = await setJson(fileKey, { appId })
    .then(upload => {
      return true
    })
    .catch(_ => false)

  return lockStatus ? { success: true } : { success: false }
}

export async function finalizeFile (filePath, extras) {
  const locked = await hasLock(filePath)
  if (!locked) {
    return new Error('You do not have lock')
  }
  console.log('Finalizing review for ', filePath, extras)
  const corrections = (await getCorrections(filePath)).map(c => [c.wordId, c.newWord])
  const lookup = Object.fromEntries(corrections)
  console.log('Corrections lookup ', lookup, extras)

  const result = await getStoredResult(filePath)

  const updatePages = result.pages.map(p => {
    p.words = p.words.map(w => {
      const newWord = lookup[w.Id]
      if (newWord) {
        w.Text = newWord
        w.Confidence = 101
      }
      return w
    })

    return p
  })

  return generateResult(extras.originalPath || filePath, null, extras.output, { pages: updatePages })
    .then(_ => {
      cleanUpFiles(filePath)
      return _
    })
}

async function cleanUpFiles (filePath) {
  const cacheFile = getCacheFile(filePath)
  const lockKey = getMetadataKey('lock', filePath)
  const flagsKey = FLAGS_KEY(filePath)
  const correctionsKey = CORRECTIONS_KEY(filePath)
  const resultsKey = SAVED_RESULT_KEY(filePath)
  const summaryKey = FLAGGED_SUMMARY_KEY(filePath)

  return Promise.all([
    fs.promises.unlink(cacheFile),
    deleteFiles([flagsKey, lockKey, correctionsKey, resultsKey, summaryKey])
  ])
}
