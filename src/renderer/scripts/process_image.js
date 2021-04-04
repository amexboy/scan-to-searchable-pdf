import fs from 'fs'
import im from 'image-size'
import { detectDocumentText } from '@/scripts/aws'
import PDFDocument from 'pdfkit'

const getImageSize = path => {
  return (new Promise((resolve, reject) => {
    im(path, (err, data) => {
      if (err) return reject(err)
      return resolve(data)
    })
  }))
    .catch(err => {
      console.log(err)
      return {
        type: 'pdf'
      }
    })
}

export const processImage = async (filePath, fileContent, output, useCached) => {
  const result = await detectDocumentText(filePath, fileContent, useCached, { type: 'image', output })

  const doc = new PDFDocument({ autoFirstPage: false })

  const imageSize = await getImageSize(filePath)
  console.log(imageSize)

  doc.pipe(fs.createWriteStream(output))
  doc.addPage({ margin: 0, size: [imageSize.width, imageSize.height] })

  Object.values(result.words)
    .forEach(t => {
      doc
        .rect(
          t.Geometry.BoundingBox.Left * imageSize.width,
          t.Geometry.BoundingBox.Top * imageSize.height,
          t.Geometry.BoundingBox.Width * imageSize.width,
          t.Geometry.BoundingBox.Height * imageSize.height).fill('#FFF')
        .fontSize(t.Geometry.BoundingBox.Height * imageSize.height).fill('#000')
        . text(t.Text, t.Geometry.BoundingBox.Left * imageSize.width, t.Geometry.BoundingBox.Top * imageSize.height)
    })

  doc.image(filePath, 0, 0, {
    // fit: [250, 300],
    align: 'center',
    valign: 'center'
  })

  doc.end()
}
