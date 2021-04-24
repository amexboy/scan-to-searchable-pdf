import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export async function processPdf (fileContent, output, result) {
  console.log('Processing file with result', result)

  const doc = await PDFDocument.load(fileContent)
  doc.setAuthor('PDF-Generator')
  result.pages
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
