
import fs from 'fs'
import { startDocumentTextDetection, detectDocumentText } from '@/scripts/aws'
import { processImage } from '@/scripts/process_image'
import { processPdf } from '@/scripts/process_pdf'

let lastProcess = Promise.resolve()
export const queueFile = (path, type, output) => {
  const func = () => {
    console.log('Starting processing for ' + path)
    return processFile(path, type, output)
  }

  lastProcess = lastProcess
    .then(func)
    .then(() => console.log('Finished last process'))
  return lastProcess
}

export const processFile = async (path, type, output) => {
  console.log(`Processing file ${path} with type ${type}`)
  const file = await fs.promises.readFile(path)
  return Promise.resolve(file)
    .then(file => {
      console.log('Got file content, sending to AWS')
      return type === '.pdf' ? startDocumentTextDetection(file, type) : detectDocumentText(file)
    })
    .then(result => {
      if (type === '.pdf') {
        return processPdf(path, file, output, result)
      }

      return processImage(path, file, output, result)
    })
}
