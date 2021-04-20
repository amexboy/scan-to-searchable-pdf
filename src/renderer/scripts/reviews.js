import { dbFactory, getConfig, getOrSetConfig, getCredential } from '@/scripts/db'
import { processFile } from '@/scripts/process_file'
import { S3 } from '@aws-sdk/client-s3'

const flagStore = dbFactory('flags.db')
const updateStore = dbFactory('updates.db')

function getPrefix (type) {
  return `searchable-pdf/metadata/${type}`
}
function getKey (type, file) {
  const key = `${file}`.replace(/[/\\]/ig, '_')
  return `${getPrefix(type)}/${key}.json`
}

async function uploadS3 (key, data, credentials, bucketName) {
  credentials = credentials || await getCredential()
  const s3 = new S3(credentials)
  bucketName = bucketName || await getConfig('bucket_name')

  const uploadCommand = {
    Body: JSON.stringify(data),
    Bucket: bucketName,
    Key: key
  }

  return s3.putObject(uploadCommand)
}

async function getFromS3 (key, credentials, bucketName) {
  credentials = credentials || await getCredential()
  const s3 = new S3(credentials)
  bucketName = bucketName || await getConfig('bucket_name')

  const request = {
    Bucket: bucketName,
    Key: key
  }

  return s3.getObject(request)
    .then(res => {
      return res.Body.read()
      // return getStream.buffer(res.Body)
      // setTimeout(() => res.Body.addListener('end', console.log), 1000)
      // return new Promise(resolve => setTimeout(() => resolve(res.Body.toString()), 3000))
      // return new Promise(resolve => setTimeout(() => resolve(res.Body.read()), 1000))
    })
    .then(body => {
      console.log(body)

      return JSON.parse(body.toString('utf-8'))
    })
}

export const flagForReview = async (filePath, words, extras) => {
  const fileKey = getKey('flags', filePath)
  const data = {
    extras,
    words: words.map(({ Id, Text, Confidence, Page, Geometry }) =>
      ({ Id, Text, Confidence, Page, Geometry })),
    // ({ Id, Text, Confidence, Page, Geometry: { BoundingBox: Geometry.BoundingBox } })),
    path: filePath,
    wordsCount: words.length
  }

  const uploadResult = await uploadS3(fileKey, data)
  console.log('Flags uploaded succesfully', uploadResult)

  return uploadResult

  // return Promise.all(
  //   words.map(word => {
  //     console.log(`Flagged ${filePath} with word id ${word.Id}`, word, extras)
  //     return flagStore.update({ filePath, wordId: word.Id },
  //       { filePath, wordId: word.Id, word, extras }, { upsert: true })
  //   })
  // )
}

const queryS3 = (key, query, bucketName, s3) => {
  const command = { Bucket: bucketName,
    Key: key,
    ExpressionType: 'SQL',
    InputSerialization: { JSON: { Type: 'DOCUMENT' } },
    OutputSerialization: { JSON: { RecordDelimiter: '\n' } },
    Expression: query }

  return s3.selectObjectContent(command)
    .then(async res => {
      let out = ''
      for await (const x of res.Payload) {
        if (x.Records) {
          const str = new TextDecoder().decode(x.Records.Payload)
          out += str
        }
      }
      return JSON.parse(out)
    })
}

export const getFlagedFiles = async () => {
  const prefix = getPrefix('flags')

  const credentials = await getCredential()
  const s3 = new S3(credentials)
  const bucketName = await getConfig('bucket_name')

  const request = {
    Bucket: bucketName,
    Prefix: prefix
  }

  const files = await s3.listObjects(request)
    .then(res => res.Contents)
    .catch(err => {
      console.log(err)
      return []
    })

  console.log('Flagged objects', files, s3)
  const query = 'SELECT s.path, s.extras, s.wordsCount FROM s3object s LIMIT 1'

  return Promise.all(
    files.map(f => f.Key)
      .map(key => queryS3(key, query, bucketName, s3)))

  // return flagStore.find({})
  //   .then(res => {
  //     return res.reduce((res, flag) => {
  //       const old = res[flag.filePath] || { wordCount: 0, words: [], extras: flag.extras }
  //       old.wordCount++
  //       old.words.push({ ...flag.word, path: flag.filePath })

  //       res[flag.filePath] = old
  //       return res
  //     }, {})
  //   })
}

export const getFlaggedWords = async (filePath, page, pageSize = 5) => {
  const fileKey = getKey('flags', filePath)
  console.log(fileKey)

  const stored = await flagStore.find({ fileKey })
  console.log(stored)
  if (stored.length > 0) {
    return stored[0].words
  }
  const credentials = await getCredential()
  const s3 = new S3(credentials)
  const bucketName = await getConfig('bucket_name')

  const query = 'SELECT s.words FROM s3object s'
  const res = await queryS3(fileKey, query, bucketName, s3)
  console.log(res)
  flagStore.update({ fileKey }, { fileKey, words: res.words }, { upsert: true })
  return res.words
}

export const approveWords = async (filePath, pending) => {
  console.log(pending)

  return Promise.all(
    pending.map(p => approveWord(filePath, p.word.Id, p.newWord))
  )
  // const fileKey = getKey('corrections', filePath)
  // const data = {
  //   corrections: pending.map(w =>
  //     ({ wordId: w.Id, newWord: w.newWord })),
  //   path: filePath,
  //   count: pending.length
  // }

  // const uploadResult = await uploadS3(fileKey, data)
  // console.log('Flags uploaded succesfully', uploadResult)

  // return uploadResult
}

export const approveWord = (filePath, wordId, newWord) => {
  return flagStore.find({ filePath, wordId })
    .then(res => {
      const word = res[0]
      console.log('Removing flagged word', filePath, wordId, word, newWord)
      return updateStore
        .update({ filePath, wordId }, { filePath, wordId, correction: newWord || word.word.Text }, { upsert: true })
        .then(_ => word)
    })
    .then(word => {
      flagStore.remove({ filePath, wordId })
      return word
    })
    .then(word => {
      return flagStore.find({ filePath })
        .then(res => {
          console.log(res)
          if (res.length === 0) {
            console.log('Regenerating file')
            const fileToProcess = word.extras.originalPath || filePath
            return processFile(fileToProcess, word.extras.type, word.extras.output, true)
          }
        })
    })
}

export const wordUpdate = (filePath, wordId) => {
  return updateStore.find({ filePath, wordId })
    .then(([word]) => {
      return word ? word.correction : undefined
    })
}

export const lock = async (file, force = false) => {
  const credentials = await getCredential()
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))
  const bucketName = await getConfig('bucket_name')
  const fileKey = getKey('lock', file)

  console.log('Checking if lock exists for ', appId, bucketName, fileKey)

  const appWithLock = force
    ? null
    : await getFromS3(fileKey, credentials, bucketName)
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

  const lockStatus = await uploadS3(fileKey, { appId }, credentials, bucketName)
    .then(upload => {
      return true
    })
    .catch(_ => false)

  return lockStatus ? { success: true } : { success: false }
}
