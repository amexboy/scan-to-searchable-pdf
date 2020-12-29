import crypto from 'crypto'
import { Textract } from '@aws-sdk/client-textract'
import { S3 } from '@aws-sdk/client-s3'
const textract = new Textract({})
const s3 = new S3()
const checkInterval = 3000

const getBucketName = () => {
  return process.env.BUCKET_NAME
}

export const detectDocumentText = async file => {
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
  const fileId = crypto.randomBytes(16).toString('hex')
  const fileKey = `searchable-pdf/input/${fileId}.${type}`
  // const outpoutFileKey = `${fileKey}_output`

  const uploadCommand = {
    Body: file,
    Bucket: getBucketName(),
    Key: fileKey
  }

  const textractCommand = {
    DocumentLocation: { /* required */
      S3Object: {
        Bucket: getBucketName(),
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
        Bucket: getBucketName(),
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
