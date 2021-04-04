
import fs from 'fs'
import { processImage } from '@/scripts/process_image'
import { processPdf } from '@/scripts/process_pdf'

let lastProcess = Promise.resolve()
export const queueFile = (path, type, output, useCached) => {
  const func = () => {
    console.log('Starting processing for ' + path)
    return processFile(path, type, output, useCached)
  }

  lastProcess = lastProcess.then(func, func)

  return lastProcess
}

export const processFile = async (path, type, output, useCached) => {
  const useCachedCopy = useCached || process.env.NODE_ENV === 'development'
  console.log(`Processing file ${path} with type ${type}`)
  return fs.promises.readFile(path)
    .then(fileContent => {
      if (type === '.pdf') {
        return processPdf(path, fileContent, output, useCachedCopy)
      }

      return processImage(path, fileContent, output, useCachedCopy)
    })
}
