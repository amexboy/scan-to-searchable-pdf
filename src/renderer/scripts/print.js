import 'pdfjs-dist/build/pdf.worker.entry'
import PDFDocument from 'pdfkit'

const fs = require('fs')
const pdfjsLib = require('pdfjs-dist')

export const convertPage = page => {
  return Promise.resolve(page)
}

export const renderPdfData = (pdfData, outputStream) => {
  const doc = pdfjsLib.getDocument(pdfData)

  return doc.promise
    .then(pdf => Promise.all(Array
      .from({ length: pdf.numPages }, (v, k) => pdf.getPage(k + 1))
    ))
    .then(pages => {
      const outputDoc = new PDFDocument({ autoFirstPage: false })

      outputDoc.pipe(outputStream)

      return Promise.all(
        pages
          .map(page => {
            return convertPage(page)
              .then(image => {
                const imageSize = page.getViewport({ scale: 1.0 })

                outputDoc.addPage({ margin: 0, size: [imageSize.width, imageSize.height] })

                console.log('adding image')
                outputDoc.image(image, 0, 0, {
                  fit: [imageSize.width, imageSize.height],
                  align: 'center',
                  valign: 'center'
                })
              })
          })
      )
        .then(_ => {
          outputDoc.end()
          return new Promise(function (resolve, reject) {
            console.log('Done generationg PDF from converted images')
            outputStream.on('finish', resolve)
          })
        })
    })
}

export default (input, output) => {
  return renderPdfData(new Uint8Array(fs.readFileSync(input)), fs.createWriteStream(output))
}
