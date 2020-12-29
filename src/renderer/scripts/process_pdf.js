import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export const processPdf = async (path, fileContent, output, result) => {
  const doc = await PDFDocument.load(fileContent)
  //   const page = doc.addPage([imageSize.width, imageSize.height])

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

  console.log(pages)

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
