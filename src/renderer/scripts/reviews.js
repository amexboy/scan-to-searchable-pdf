
import fs from 'fs'
import { dirname, resolve } from 'path'
import { S3 } from '@aws-sdk/client-s3'
import { generateResult } from '@/scripts/process_file'
import { uploadS3, getJsonFromS3, queryS3, getMetadataPrefix, getMetadataKey, deleteObjects } from './aws'
import { resolver, createDb, getConfig, getOrSetConfig, getCredential } from './db'
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

  const uploadResult = await Promise.all([

    uploadS3(summaryKey, JSON.stringify({
      extras,
      path: filePath,
      flagsCount: flags.length
    })),

    uploadS3(flaggsKey, JSON.stringify(flags)),

    uploadS3(pagesKey, JSON.stringify(pages))
  ])

  console.log('Flags uploaded succesfully', uploadResult)

  return uploadResult
}

export const getFlagedFiles = async () => {
  const credentials = await getCredential()
  const s3 = new S3(credentials)
  const bucketName = await getConfig('bucket_name')

  const request = {
    Bucket: bucketName,
    Prefix: FLAGGED_SUMMARY_PREFIX
  }

  const files = await s3.listObjects(request)
    .then(res => res.Contents || [])
    .catch(err => {
      console.log(err)
      return []
    })

  console.log('Flagged objects', files, s3)
  const query = 'SELECT s.path, s.extras, s.flagsCount FROM s3object[*] s LIMIT 1'

  return Promise.all(
    files.map(f => f.Key)
      .map(key => queryS3(key, query)))
}

export const getStoredResult = async filePath => {
  const fileKey = SAVED_RESULT_KEY(filePath)
  console.log('Stored result fileKey', fileKey)

  const storedPages = await new Promise(resolve => resultStore.find({ fileKey }, resolver(resolve)))
  const storedFlags = await getFlags(filePath)

  if (storedPages.length > 0 && storedPages[0].pages.length > 0) {
    return { pages: storedPages[0].pages, flagged: storedFlags }
  }

  const pages = await getJsonFromS3(fileKey).catch(_ => null) //, credentials, bucketName)

  console.log('Found pages', pages)

  if (pages) {
    resultStore.update({ fileKey }, { fileKey, pages }, { upsert: true })

    return { pages }
  }
  return null
}

export async function getCorrections (filePath) {
  const correctionsKey = CORRECTIONS_KEY(filePath)

  const corrections = await getJsonFromS3(correctionsKey).catch(_ => [])

  return corrections
}

export async function getFlags (filePath) {
  const fileKey = FLAGS_KEY(filePath)

  const stored = await new Promise(resolve => flagStore.find({ fileKey }, resolver(resolve)))
  console.log('Cached flags', stored)
  if (stored.length > 0 && stored[0].flags.length > 0) {
    return stored[0].flags
  }

  const result = await getJsonFromS3(fileKey).catch(_ => [])
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
  const result = await getStoredResult(filePath)

  const cacheFile = getCacheFile(filePath)

  await fs.promises.mkdir(dirname(cacheFile), { recursive: true }).catch(_ => false)
  const cached = await fs.promises.access(cacheFile).then(_ => true).catch(_ => false)
  console.log('File cached check ', cached, cacheFile)
  if (!cached) {
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
  const uploadResult = await uploadS3(fileKey, JSON.stringify(listToApprove))
  console.log('Corrections uploaded succesfully', uploadResult)

  return uploadResult
}

export const unlock = async file => {
  const credentials = await getCredential()
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))
  const bucketName = await getConfig('bucket_name')
  const fileKey = getMetadataKey('lock', file)

  console.log('Checking if lock exists for ', appId, bucketName, fileKey)

  const appWithLock = await getJsonFromS3(fileKey, credentials, bucketName)
    .then(res => {
      return res.appId
    })
    .catch(_ => {
      console.log('Maybe', _)
      return null
    })

  if (appWithLock !== appId) {
    return { success: true }
  }

  console.log('Going to release lock', appWithLock, appId)

  const lockStatus = await uploadS3(fileKey, '', credentials, bucketName)
    .then(upload => {
      return true
    })
    .catch(_ => false)

  return lockStatus ? { success: true } : { success: false }
}

export const lock = async (file, force = false) => {
  const credentials = await getCredential()
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))
  const bucketName = await getConfig('bucket_name')
  const fileKey = getMetadataKey('lock', file)

  console.log('Checking if lock exists for ', appId, bucketName, fileKey)

  const appWithLock = force
    ? null
    : await getJsonFromS3(fileKey, credentials, bucketName)
      .then(res => {
        return res.appId
      })
      .catch(_ => {
        console.log('Maybe', _)
        return null
      })

  if (appWithLock != null && appWithLock !== appId) {
    return { success: false }
  } else if (appWithLock === appId) {
    return { success: true }
  }

  console.log('Going to aquire lock', appWithLock, force, appId)

  const lockStatus = await uploadS3(fileKey, JSON.stringify({ appId }), credentials, bucketName)
    .then(upload => {
      return true
    })
    .catch(_ => false)

  return lockStatus ? { success: true } : { success: false }
}

export async function finalizeFile (filePath, extras) {
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
    deleteObjects([flagsKey, lockKey, correctionsKey, resultsKey, summaryKey])
  ])
}
