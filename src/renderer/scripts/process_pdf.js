import fs from 'fs'
import path from 'path'
import { PDFDocument } from 'pdf-lib'
import renderPdf from '@/scripts/print'
import { startDocumentTextDetection, transform } from '@/scripts/aws'
import { getConfig } from '@/scripts/db'
import { flagForReview } from '@/scripts/reviews'

const forceFetch = process.env.NODE_ENV === 'production'
export const processPdf = (inputPath, fileContent, output) => {
  return startDocumentTextDetection(inputPath, fileContent, '.pdf', forceFetch)
    .then(transform)
    // return Promise.resolve({ lines: {} })
    .then(result => {
      if (Object.keys(result.lines).length === 0) {
        console.log(`${inputPath} returned empty result, rendering and re-uploading`)
        const fileName = path.basename(inputPath)
        const outputDir = path.dirname(output)
        const renderedFile = path.resolve(outputDir, `${fileName}_rendered.pdf`)

        return renderPdf(path, renderedFile)
          .then(_ => fs.promises.readFile(renderedFile))
          .then(renderedFileContent => startDocumentTextDetection(renderedFileContent, '.pdf'))
          .then(transform)
      }

      return result
    })
    .then(result => processPdfInternal(inputPath, fileContent, output, result.pages))
}
async function processPdfInternal (inputPath, fileContent, output, pages) {
  const doc = await PDFDocument.load(fileContent)
  doc.setAuthor('PDF-Generator')
  const confidence = await getConfig('confidence', 99)

  pages
    .forEach(pageInfo => {
      const page = doc.getPage(pageInfo.page)
      const { width, height } = page.getSize()

      pageInfo.words.forEach(t => {
        if (t.Confidence < confidence) {
          flagForReview(inputPath, t, { type: 'pdf', output })
        }

        const size = t.Geometry.BoundingBox.Height * height

        page.drawText(t.Text, {
          x: t.Geometry.BoundingBox.Left * width,
          y: height - (t.Geometry.BoundingBox.Top * height) - size,
          size,
          opacity: 0
        })
      })
    })

  return doc.save()
    .then(bytes => {
      return fs.promises.writeFile(output, bytes)
    })
}
