
import fs from 'fs'
import { startDocumentTextDetection, detectDocumentText } from '@/scripts/aws'
import { processImage } from '@/scripts/process_image'
import { processPdf } from '@/scripts/process_pdf'

export const processFile = async (path, type, output) => {
  const file = await fs.promises.readFile(path)
  return Promise.resolve(file)
    .then(file => {
      return type === '.pdf' ? startDocumentTextDetection(file, type) : detectDocumentText(file)
    })
    .then(result => {
      if (type === '.pdf') {
        return processPdf(path, file, output, result)
      }

      return processImage(path, file, output, result)
    })
}
