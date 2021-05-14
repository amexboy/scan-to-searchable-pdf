import crypto from 'crypto'
import { Textract } from '@aws-sdk/client-textract'
import { S3 } from '@aws-sdk/client-s3'
import { getConfig, getCredential } from '@/scripts/db'
const checkInterval = 3000

export const transform = async (fileName, result) => {
  if (!result) {
    return result
  }

  const flags = []
  const confidence = await getConfig('confidence', 99)
  const words = (await Promise.all(result.Blocks
    .filter(t => t.BlockType === 'WORD')
    .map(({ Id, Text, Confidence, Page, Geometry }) => {
      const word = { Id, Text, Confidence, Page, Geometry }

      if (word.Confidence < confidence) {
        flags.push(word)
      }
      return word
    })
  ))
    .reduce((res, word) => {
      res[word.Id] = word
      return res
    }, {})

  const lines = result.Blocks
    .filter(t => t.BlockType === 'LINE')
    .map(({ Id, Text, Confidence, Page, Geometry, Relationships }) =>
      ({ Id, Text, Confidence, Page, Geometry, Relationships }))
    .reduce((res, line) => {
      const lineWords = line.Relationships ? line.Relationships.map(r => r.Ids).flat().map(id => words[id]) : []
      res[line.Id] = { line, words: lineWords }

      return res
    }, {})

  const pages = result.Blocks
    .filter(t => t.BlockType === 'PAGE')
    .map((page, i) => {
      const pageLines = page.Relationships ? page.Relationships.map(r => r.Ids).flat().map(id => lines[id]) : []
      const pageWords = pageLines.flatMap(line => line.words).map(w => { w.Page = i + 1; return w })
      return {
        page: i,
        lines: pageLines.map(l => l.line),
        words: pageWords
      }
    })

  return {
    pages,
    wordsCount: Object.keys(words).length,
    linesCount: Object.keys(lines).length,
    flagged: flags
  }
}

export const detectDocumentText = async (fileName, fileContent) => {
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
      return transform(fileName, result)
    })
    .catch(err => {
      console.log(`Processing ${fileName} failed`, err)

      throw err
    })
}

export const startDocumentTextDetection = async (fileName, fileContent, type) => {
  const [textract, s3] = await getCredential().then(config => [new Textract(config), new S3(config)])

  const fileId = crypto.randomBytes(16).toString('hex')
  const fileKey = `searchable-pdf/input/${fileId}.${type}`

  const bucketName = await getConfig('bucket_name')

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
      return transform(fileName, result)
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
