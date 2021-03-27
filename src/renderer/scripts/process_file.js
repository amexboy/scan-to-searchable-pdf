
import fs from 'fs'
import { processImage } from '@/scripts/process_image'
import { processPdf } from '@/scripts/process_pdf'

let lastProcess = Promise.resolve()
export const queueFile = (path, type, output) => {
  const func = () => {
    console.log('Starting processing for ' + path)
    return processFile(path, type, output)
  }

  lastProcess = lastProcess.then(func, func)

  return lastProcess
}

export const processFile = async (path, type, output) => {
  console.log(`Processing file ${path} with type ${type}`)
  return fs.promises.readFile(path)
    .then(fileContent => {
      if (type === '.pdf') {
        return processPdf(path, fileContent, output)
      }

      return processImage(path, fileContent, output)
    })
}
