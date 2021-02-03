import crypto from 'crypto'
import { Textract } from '@aws-sdk/client-textract'
import { S3 } from '@aws-sdk/client-s3'
import { dbFactory } from '@/scripts/db'

const checkInterval = 3000
const config = dbFactory('config.db')

export const getCredential = () => {
  return Promise.all([
    config.find({ key: 'apiKeyId' }).then(([res]) => res ? res.value : null),
    config.find({ key: 'apiKeySecret' }).then(([res]) => res ? res.value : null),
    config.find({ key: 'region' }).then(([res]) => res ? res.value : null)
  ])
    .then(([apiKeyId, apiKeySecret, region]) => {
      const credentials = apiKeyId && apiKeySecret ? { accessKeyId: apiKeyId, secretAccessKey: apiKeySecret } : null

      return { region: region || 'us-east-1', credentials }
    })
}

export const getBucketName = () => {
  return config.find({ key: 'bucket_name' }).then(([name]) => name ? name.value : null)
}

export const setBucketName = bucketName => {
  return config.update({ key: 'bucket_name' }, { key: 'bucket_name', value: bucketName }, { upsert: true })
}

export const setAwsAccess = (apiKeyId, apiKeySecret, region) => {
  return Promise.all([
    config.update({ key: 'apiKeyId' }, { key: 'apiKeyId', value: apiKeyId }, { upsert: true }),
    config.update({ key: 'apiKeySecret' }, { key: 'apiKeySecret', value: apiKeySecret }, { upsert: true }),
    config.update({ key: 'region' }, { key: 'region', value: region }, { upsert: true })
  ])
}

export const detectDocumentText = async file => {
  const textract = await getCredential().then(config => new Textract(config))

  console.log(textract)
  const command = {
    Document: {
      Bytes: file
    }
  }

  return Promise.resolve(command)
    .then(command => textract.detectDocumentText(command))
    .then(result => {
      console.log(result)
      return result
    })
    .catch(err => {
      console.log(err)

      throw err
    })
}

export const startDocumentTextDetection = async (file, type) => {
  const [textract, s3] = await getCredential().then(config => [new Textract(config), new S3(config)])

  const fileId = crypto.randomBytes(16).toString('hex')
  const fileKey = `searchable-pdf/input/${fileId}.${type}`
  // const outpoutFileKey = `${fileKey}_output`

  const bucketName = await getBucketName()

  const uploadCommand = {
    Body: file,
    Bucket: bucketName,
    Key: fileKey
  }

  const textractCommand = {
    DocumentLocation: { /* required */
      S3Object: {
        Bucket: bucketName,
        Name: fileKey
      }
    },
    ClientRequestToken: fileId
  }

  return Promise.resolve(uploadCommand)
    .then(command => s3.putObject(command))
    .then(s3Res => {
      console.log(s3Res)
      return textract.startDocumentTextDetection(textractCommand)
    })
    .then(start => {
      const checkCommand = {
        JobId: start.JobId
      }

      return new Promise((resolve, reject) => {
        const intervalTimer = setInterval(async function () {
          const result = await textract.getDocumentTextDetection(checkCommand)
          if (result.JobStatus === 'SUCCEEDED') {
            clearInterval(intervalTimer)
            return resolve(result)
          }

          if (result.JobStatus !== 'IN_PROGRESS') {
            clearInterval(intervalTimer)
            return reject(result)
          }
        }, checkInterval)
      })
    })
    .finally(param => {
      s3.deleteObjects({
        Bucket: bucketName,
        Delete: {
          Objects: [
            { Key: fileKey }
          ]
        }
      })
        .catch(err => {
          console.log(err)
        })
    })
    .then(result => {
      console.log(result)
      return result
    })
    .catch(err => {
      console.log({ err })

      throw err
    })
}
