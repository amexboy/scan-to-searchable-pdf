import Canvas from 'canvas'
import 'pdfjs-dist/build/pdf.worker.entry'
import PDFDocument from 'pdfkit'

const fs = require('fs')
const pdfjsLib = require('pdfjs-dist')

export const convertPage = page => {
  const viewport = page.getViewport({ scale: 3 })
  const canvasFactory = new NodeCanvasFactory()
  const canvasAndContext = canvasFactory.create(
    viewport.width,
    viewport.height
  )
  const renderContext = {
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory,
    intent: 'display'
  }

  const renderTask = page.render(renderContext)

  return renderTask.promise
    .then(() => {
    // Convert the canvas to an image buffer.
      console.log('Converted to image')
      return canvasAndContext.canvas.toBuffer('image/jpeg', { quality: 0.5 })
    })
    .catch(err => {
      console.log('failed to convert page to image', err)
      throw err
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
            console.log('Done generationg PDF from converted images')
            outputStream.on('finish', resolve)
          })
        })
    })
}

export default (input, output) => {
  return renderPdfData(new Uint8Array(fs.readFileSync(input)), fs.createWriteStream(output))
}

function NodeCanvasFactory () { }

NodeCanvasFactory.prototype = {
  create (width, height) {
    const canvas = Canvas.createCanvas(width, height)
    const context = canvas.getContext('2d')

    context.imageSmoothingEnabled = false
    context.quality = 'best'
    context.patternQuality = 'best'

    return {
      canvas,
      context
    }
  },

  reset (canvasAndContext, width, height) {
    // assert(canvasAndContext.canvas, 'Canvas is not specified')
    // assert(width > 0 && height > 0, 'Invalid canvas size')
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  },

  destroy (canvasAndContext) {
    // assert(canvasAndContext.canvas, 'Canvas is not specified')

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  }
}
