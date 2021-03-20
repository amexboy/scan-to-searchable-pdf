import fs from 'fs'
import path from 'path'
import { PDFDocument } from 'pdf-lib'
import renderPdf from '@/scripts/print'
import { startDocumentTextDetection } from '@/scripts/aws'

export const convertToInternanlFormat = result => {
  const lines = result.Blocks
    .filter(t => t.BlockType === 'LINE')
    .reduce((res, line) => {
      res[line.Id] = line
      return res
    }, {})
  console.log(lines)

  const pages = result.Blocks
    .filter(t => t.BlockType === 'PAGE')
    .map((page, i) => {
      return {
        page: i,
        lines: page.Relationships ? page.Relationships.map(r => r.Ids).flat().map(id => lines[id]) : []
      }
    })

  return { lines, pages }
}

export const processPdf = (inputPath, fileContent, output) => {
  return startDocumentTextDetection(fileContent, '.pdf')
    .then(convertToInternanlFormat)
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
          .then(convertToInternanlFormat)
      }

      return result
    })
    .then(result => processPdfInternal(path, fileContent, output, result.pages))
}
async function processPdfInternal (path, fileContent, output, pages) {
  const doc = await PDFDocument.load(fileContent)
  doc.setAuthor('PDF-Generator')

  pages
    .forEach(pageInfo => {
      const page = doc.getPage(pageInfo.page)
      const { width, height } = page.getSize()

      pageInfo.lines.forEach(t => {
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
