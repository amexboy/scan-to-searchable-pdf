
import fs from 'fs'
import { extname, dirname, basename, resolve } from 'path'
import { processImage } from '@/scripts/process_image'
import { processPdf } from '@/scripts/process_pdf'
import renderPdf from '@/scripts/print'
import { flagForReview, getStoredResult } from './reviews'
import { startDocumentTextDetection, detectDocumentText } from './aws'

let lastProcess = Promise.resolve()
export const queueFile = (path, output, useCached, extras) => {
  const func = () => {
    console.log('Starting processing for ' + path)
    return processFile(path, output, useCached, extras)
  }

  lastProcess = lastProcess.then(func, func)

  return lastProcess
}

async function getTextratResut (inputPath, fileContent, output, type, useCached) {
  let result
  if (useCached || process.env.NODE_ENV === 'development') {
    result = await getStoredResult(inputPath)
  }

  if (result) {
    console.log(`Cached result found for ${inputPath}`)
  } else if (type === '.pdf') {
    result = await startDocumentTextDetection(inputPath, fileContent, type)
      .then(result => {
        if (result.wordsCount === 0) {
          console.log(`${inputPath} returned empty result, rendering and re-uploading`)

          const fileName = basename(inputPath)
          const outputDir = dirname(output)
          const renderedFile = resolve(outputDir, `${fileName}_rendered.pdf`)

          return renderPdf(inputPath, renderedFile)
            .then(_ => fs.promises.readFile(renderedFile))
            .then(content => startDocumentTextDetection(renderedFile, content, type))
        }

        return result
      })
  } else {
    result = await detectDocumentText(inputPath, fileContent)
  }

  return result
}

export const processFile = async (inputPath, output, useCached, extras) => {
  const type = extname(inputPath)
  console.log(`Processing file ${inputPath} `, output, useCached, extras)

  const fileContent = await fs.promises.readFile(inputPath)
  const result = await getTextratResut(inputPath, fileContent, output, type, useCached)

  if (result.flagged && result.flagged.length > 0) {
    await flagForReview(inputPath, result.flagged, result.pages, { type, output, ...extras })
      .then(_ => {
        console.log('Uploading output', _)
        return _
      })

    throw new Error('Some words were flagged')
  }

  return generateResult(inputPath, fileContent, output, result)
}

export async function generateResult (inputPath, fileContent, output, result) {
  console.log('Generationg result for ', inputPath)
  const type = extname(inputPath)
  fileContent = fileContent || await fs.promises.readFile(inputPath)

  if (type === '.pdf') {
    return processPdf(fileContent, output, result)
  }

  return processImage(inputPath, output, result)
}
