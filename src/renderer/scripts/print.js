import 'pdfjs-dist/build/pdf.worker.entry'
import PDFDocument from 'pdfkit'

const fs = require('fs')
const pdfjsLib = require('pdfjs-dist')

export const convertPage = page => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  const scale = 2.5
  const viewport = page.getViewport({ scale })
  canvas.height = viewport.height
  canvas.width = viewport.width

  // Render PDF page into canvas context
  const renderContext = {
    canvasContext: context,
    viewport
  }
  const renderTask = page.render(renderContext)
  return renderTask.promise.then(() => {
    console.log('Page rendered', canvas)
    // const image = canvas.toDataURL('image/png')
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        const reader = new FileReader()
        reader.readAsArrayBuffer(blob)

        reader.addEventListener('loadend', () => {
          resolve(reader.result)
        })
      }, 'image/png')
    })
      .then(image => {
        console.log('Image generated', image)
        return image
      })
  })
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
            outputStream.on('finish', resolve)
          })
            .then(data => {
              console.log('Done generationg PDF from converted images')
              return data
            })
        })
    })
}

export default (input, output) => {
  return renderPdfData(new Uint8Array(fs.readFileSync(input)), fs.createWriteStream(output))
}
