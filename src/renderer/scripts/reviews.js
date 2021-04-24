
import fs from 'fs'
import { dirname, resolve } from 'path'
import { S3 } from '@aws-sdk/client-s3'
import { uploadS3, getFromS3, queryS3, getMetadataPrefix, getMetadataKey, getObject } from './aws'
import { dbFactory, getConfig, getOrSetConfig, getCredential } from './db'
// import { processFile } from '@/scripts/process_file'
const { app, remote } = require('electron')

const flagStore = dbFactory('flags.db')
const resultStore = dbFactory('results.db')

export const flagForReview = async (filePath, words, pages, extras) => {
  const fileKey = getMetadataKey('flags', filePath)
  const data = {
    extras,
    pages,
    words: words.map(({ Id, Text, Confidence, Page, Geometry }) =>
      ({ Id, Text, Confidence, Page, Geometry })),
    path: filePath,
    wordsCount: words.length
  }

  const readInput = fs.createReadStream(extras.output)
  const uploadResult = await Promise.all([
    uploadS3(getMetadataKey('result', filePath, 'pdf'), readInput),
    uploadS3(fileKey, JSON.stringify(data))
  ])
  // .then(async _ => {
  //   await fs.promises.rm(extras.output)
  //   return _
  // })

  // todo: Delete output file
  console.log('Flags uploaded succesfully', uploadResult)

  return uploadResult
}

export const getFlagedFiles = async () => {
  const prefix = getMetadataPrefix('flags')

  const credentials = await getCredential()
  const s3 = new S3(credentials)
  const bucketName = await getConfig('bucket_name')

  const request = {
    Bucket: bucketName,
    Prefix: prefix
  }

  const files = await s3.listObjects(request)
    .then(res => res.Contents || [])
    .catch(err => {
      console.log(err)
      return []
    })

  console.log('Flagged objects', files, s3)
  const query = 'SELECT s.path, s.extras, s.wordsCount FROM s3object s LIMIT 1'

  return Promise.all(
    files.map(f => f.Key)
      .map(key => queryS3(key, query)))
}

export const getStoredResult = async filePath => {
  const fileKey = getMetadataKey('flags', filePath)
  console.log('Stored result fileKey', fileKey)

  const stored = await resultStore.find({ fileKey })
  console.log(stored)
  if (stored.length > 0) {
    return stored[0]
  }

  const query = 'SELECT s.pages FROM s3object s'
  const res = await queryS3(fileKey, query)
    .catch(_ => {
      console.log('Failed to run query')
      return null
    })

  if (res) {
    resultStore.update({ fileKey }, { fileKey, pages: res.pages }, { upsert: true })

    return { pages: res.pages }
  }
  return null
}

export const getFlaggedWords = async filePath => {
  const correctionsKey = getMetadataKey('corrections', filePath)
  const corrections = 'SELECT * FROM s3object s'
  const correctionsRes = await queryS3(correctionsKey, corrections).catch(_ => ({ corrections: [] }))
  console.log(correctionsRes)

  const resultKey = getMetadataKey('result', filePath, 'pdf')
  const rootPath = process.env.NODE_ENV === 'development' ? '.' : (app || remote.app).getPath('home')
  const cacheFile = resolve(`${rootPath}/results/${resultKey}`)

  await fs.promises.mkdir(dirname(cacheFile), { recursive: true }).catch(_ => false)
  const cached = await fs.promises.access(cacheFile).then(_ => true).catch(_ => false)
  console.log('File cached check ', cached, cacheFile)
  if (!cached) {
    await getObject(resultKey)
      .then(body => {
        body.pipe(fs.createWriteStream(cacheFile))
      })
  }

  const fileKey = getMetadataKey('flags', filePath)
  console.log(fileKey)

  const stored = await flagStore.find({ fileKey })
  console.log(stored)
  if (stored.length > 0) {
    return { words: stored[0].words, corrections: correctionsRes.corrections, cacheFile }
  }

  const query = 'SELECT s.words FROM s3object s'
  const res = await queryS3(fileKey, query)
  flagStore.update({ fileKey }, { fileKey, words: res.words }, { upsert: true })

  return { words: res.words, corrections: correctionsRes.corrections, cacheFile }
}

export const approveWords = async (filePath, pending) => {
  console.log(pending)

  // uploading to s3
  const fileKey = getMetadataKey('corrections', filePath)
  const data = {
    corrections: pending.map(w =>
      ({ wordId: w.word.Id, newWord: w.newWord })),
    path: filePath,
    count: pending.length
  }

  // if (res.length === 0) {
  //   console.log('Regenerating file')
  //   const fileToProcess = word.extras.originalPath || filePath
  //   return processFile(fileToProcess, word.extras.type, word.extras.output, true)
  // }
  const uploadResult = await uploadS3(fileKey, JSON.stringify(data))
  console.log('Corrections uploaded succesfully', uploadResult)

  return uploadResult
}

export const unlock = async file => {
  const credentials = await getCredential()
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))
  const bucketName = await getConfig('bucket_name')
  const fileKey = getMetadataKey('lock', file)

  console.log('Checking if lock exists for ', appId, bucketName, fileKey)

  const appWithLock = await getFromS3(fileKey, credentials, bucketName)
    .then(body => {
      return JSON.parse(body.toString('utf-8'))
    })
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
    : await getFromS3(fileKey, credentials, bucketName)
      .then(body => {
        return JSON.parse(body.toString('utf-8'))
      })
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
