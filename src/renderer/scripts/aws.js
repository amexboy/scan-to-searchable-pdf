import crypto from 'crypto'
import { Textract } from '@aws-sdk/client-textract'
import { S3 } from '@aws-sdk/client-s3'
import { dbFactory, getConfig, setConfig } from '@/scripts/db'
import { wordUpdate, flagForReview } from '@/scripts/reviews'
const checkInterval = 3000
const resultStore = dbFactory('resultStore.db')

export const getCredential = async () => {
  const [apiKeyId, apiKeySecret, region] = await Promise.all(['apiKeyId', 'apiKeySecret', 'region'].map(getConfig))
  const credentials = apiKeyId && apiKeySecret ? { accessKeyId: apiKeyId, secretAccessKey: apiKeySecret } : null

  return { region: region || 'us-east-1', credentials }
}

export const getBucketName = () => {
  return getConfig('bucket_name')
}

export const setBucketName = bucketName => {
  return setConfig('bucket_name', bucketName)
}

export const setAwsAccess = (apiKeyId, apiKeySecret, region) => {
  return Promise.all([
    setConfig('apiKeyId', apiKeyId),
    setConfig('apiKeySecret', apiKeySecret),
    setConfig('region', region)
  ])
}

export const transform = async (fileName, result, extras) => {
  if (!result) {
    return result
  }
  const confidence = await getConfig('confidence', 99)
  const words = (await Promise.all(result.Blocks
    .filter(t => t.BlockType === 'WORD')
    .map(async t => {
      const correction = await wordUpdate(fileName, t.Id)
      if (correction) {
        console.log(correction, fileName, t)
        t.Text = correction
        t.Confidence = 100
      }
      if (t.Confidence < confidence) {
        flagForReview(fileName, t, extras)
      }
      return t
    })
  ))
    .reduce((res, word) => {
      res[word.Id] = word
      return res
    }, {})

  const lines = result.Blocks
    .filter(t => t.BlockType === 'LINE')
    .reduce((res, line) => {
      const lineWords = line.Relationships ? line.Relationships.map(r => r.Ids).flat().map(id => words[id]) : []
      res[line.Id] = { line, words: lineWords }

      return res
    }, {})

  const pages = result.Blocks
    .filter(t => t.BlockType === 'PAGE')
    .map((page, i) => {
      const pageLines = page.Relationships ? page.Relationships.map(r => r.Ids).flat().map(id => lines[id]) : []
      return {
        page: i,
        lines: pageLines.map(l => l.line),
        words: pageLines.flatMap(line => line.words)
      }
    })

  return { lines, pages, words }
}

export const detectDocumentText = async (fileName, fileContent, useCached, extras) => {
  if (useCached) {
    const storedResult = await resultStore.find({ fileName })
      .then(([result]) => result ? JSON.parse(result.result) : null)
      .then(result => {
        return transform(fileName, result, extras)
      })

    if (storedResult) {
      console.log(`Cached result found for ${fileName}`, storedResult)
      return storedResult
    }
  }

  const textract = await getCredential().then(config => new Textract(config))

  const command = {
    Document: {
      Bytes: fileContent
    }
  }

  return Promise.resolve(command)
    .then(command => textract.detectDocumentText(command))
    .then(result => {
      console.log(`Processing ${fileName} succeeded`, result)
      resultStore.update({ fileName }, { fileName, result: JSON.stringify(result) }, { upsert: true })
      return transform(fileName, result, extras)
    })
    .catch(err => {
      console.log(`Processing ${fileName} failed`, err)

      throw err
    })
}

export const startDocumentTextDetection = async (fileName, fileContent, type, useCached, extras) => {
  if (useCached) {
    const storedResult = await resultStore.find({ fileName })
      .then(([result]) => result ? JSON.parse(result.result) : null)
      .then(result => {
        return transform(fileName, result, extras)
      })

    if (storedResult) {
      console.log(`Cached result found for ${fileName}`, storedResult)
      return storedResult
    }
  }

  const [textract, s3] = await getCredential().then(config => [new Textract(config), new S3(config)])

  const fileId = crypto.randomBytes(16).toString('hex')
  const fileKey = `searchable-pdf/input/${fileId}.${type}`

  const bucketName = await getBucketName()

  const uploadCommand = {
    Body: fileContent,
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
    .then(async start => {
      const checkCommand = {
        JobId: start.JobId
      }
      console.log(start)

      const mainResult = await new Promise((resolve, reject) => {
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

      return checkPages(textract, start.JobId, mainResult)
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
      console.log(`Processing ${fileName} succeeded`, result)
      resultStore.update({ fileName }, { fileName, result: JSON.stringify(result) }, { upsert: true })
      return transform(fileName, result, extras)
    })
    .catch(err => {
      console.log(`Processing ${fileName} failed`, err)

      throw err
    })
}

async function checkPages (textract, jobId, result) {
  console.log(textract, jobId, result)
  if (result.NextToken) {
    console.log('Fetching next')
    const nextPages = await fetchPages(textract, jobId, result.NextToken)
    console.log(nextPages)

    result.Blocks = result.Blocks.concat(nextPages)
  }

  return result
}

async function fetchPages (textract, jobId, nextToken) {
  const checkCommand = {
    JobId: jobId,
    NextToken: nextToken
  }
  const result = await textract.getDocumentTextDetection(checkCommand)

  if (result.NextToken) {
    return result.Blocks.concat(await fetchPages(textract, jobId, result.NextToken))
  }

  return result.Blocks
}
