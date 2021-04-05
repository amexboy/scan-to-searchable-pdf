import fs from 'fs'
import path from 'path'
import { PDFDocument } from 'pdf-lib'
import renderPdf from '@/scripts/print'
import { startDocumentTextDetection } from '@/scripts/aws'

export const processPdf = (inputPath, fileContent, output, useCached, extras) => {
  const extraCopy = { type: '.pdf', output, ...extras }
  return startDocumentTextDetection(inputPath, fileContent, '.pdf', useCached, extraCopy)
    // return Promise.resolve({ lines: {} })
    .then(result => {
      if (Object.keys(result.lines).length === 0) {
        console.log(`${inputPath} returned empty result, rendering and re-uploading`)
        const fileName = path.basename(inputPath)
        const outputDir = path.dirname(output)
        const renderedFile = path.resolve(outputDir, `${fileName}_rendered.pdf`)

        return renderPdf(inputPath, renderedFile)
          .then(_ => fs.promises.readFile(renderedFile))
          .then(renderedFileContent =>
            startDocumentTextDetection(renderedFile, renderedFileContent, '.pdf', useCached, extraCopy))
      }

      return result
    })
    .then(result => processPdfInternal(inputPath, fileContent, output, result.pages))
}
async function processPdfInternal (inputPath, fileContent, output, pages) {
  const doc = await PDFDocument.load(fileContent)
  doc.setAuthor('PDF-Generator')
  pages
    .forEach(pageInfo => {
      const page = doc.getPage(pageInfo.page)
      const { width, height } = page.getSize()

      pageInfo.words.forEach(t => {
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
