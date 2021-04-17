import { dbFactory, getConfig, getOrSetConfig, getCredential } from '@/scripts/db'
import { processFile } from '@/scripts/process_file'
import { S3 } from '@aws-sdk/client-s3'

const flagStore = dbFactory('flags.db')
const updateStore = dbFactory('updates.db')

export const flagForReview = (filePath, word, extras) => {
  console.log(`Flagged ${filePath} with word id ${word.Id}`, word, extras)
  return flagStore.update({ filePath, wordId: word.Id }, { filePath, wordId: word.Id, word, extras }, { upsert: true })
}

export const getFlagedFiles = () => {
  return flagStore.find({})
    .then(res => {
      return res.reduce((res, flag) => {
        const old = res[flag.filePath] || { wordCount: 0, words: [], extras: flag.extras }
        old.wordCount++
        old.words.push({ ...flag.word, path: flag.filePath })

        res[flag.filePath] = old
        return res
      }, {})
    })
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

function getKey (file) {
  const key = `${file}`.replace(/[/\\]/ig, '_')
  return `searchable-pdf/lock/${key}.json`
}

export const lock = async (file, force = false) => {
  const credentials = await getCredential()
  const s3 = new S3(credentials)
  const appId = await getOrSetConfig('app_id', Math.random().toString(36).substring(7))
  const bucketName = await getConfig('bucket_name')
  const fileKey = getKey(file)

  console.log('Checking if lock exists for ', appId, bucketName, fileKey)

  const appWithLock = force
    ? null
    : await s3.getObject({ Key: fileKey, Bucket: bucketName })
      .then(res => {
        return JSON.parse(res.Body.read().toString('utf-8')).appId
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

  const uploadCommand = {
    Body: JSON.stringify({ appId }),
    Bucket: bucketName,
    Key: fileKey
  }

  const lockStatus = await s3.putObject(uploadCommand)
    .then(upload => {
      return true
    })
    .catch(_ => false)

  return lockStatus ? { success: true } : { success: false }
}
