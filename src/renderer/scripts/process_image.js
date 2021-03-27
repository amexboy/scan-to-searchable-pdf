import fs from 'fs'
import im from 'image-size'
import { detectDocumentText } from '@/scripts/aws'
import { getConfig } from '@/scripts/db'
import { flagForReview } from '@/scripts/reviews'
import PDFDocument from 'pdfkit'
const forceFetch = process.env.NODE_ENV === 'production'

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

export const processImage = async (filePath, fileContent, output) => {
  const result = await detectDocumentText(filePath, fileContent, forceFetch)
  const confidence = await getConfig('confidence', 99)

  const doc = new PDFDocument({ autoFirstPage: false })

  const imageSize = await getImageSize(filePath)
  console.log(imageSize)

  doc.pipe(fs.createWriteStream(output))
  doc.addPage({ margin: 0, size: [imageSize.width, imageSize.height] })

  result.Blocks
    .filter(t => t.BlockType === 'WORD')
    .forEach(t => {
      if (t.Confidence < confidence) {
        flagForReview(filePath, t, { type: 'image', output })
      }

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
