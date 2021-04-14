<template>
  <v-card :loading="loading">
    <v-row>
      <v-col cols="12" xs="12">
        <v-breadcrumbs :items="parents" divider="\" />
      </v-col>
      <v-col cols="12" xs="12">
        Word detected: <span class="strong"> {{ word.text }}</span>
      </v-col>
      <v-col>
        <canvas ref="pdf" style="max-width: 100%; max-height: 500px" />
      </v-col>
    </v-row>
  </v-card>
</template>
<script>
import { splitPath } from '@/scripts/utils'
const pdfjsLib = require('pdfjs-dist')

export default {
  props: {
    word: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      loading: true
    }
  },
  computed: {
    fileName () {
      return this.word.extras.output
    },
    file () {
      if (!this.fileName) return undefined

      return `file://${this.fileName}`
    },
    parents () {
      return this.fileName ? splitPath(this.fileName, true) : []
    }
  },
  mounted () {
    console.log(this.word)
    this.drawPdf(this.word)
  },
  methods: {

    async drawPdf (id) {
      if (!id) {
        return
      }
      const loadingTask = pdfjsLib.getDocument(this.file)
      const pdf = await loadingTask.promise

      // Load information from the first page.
      const word = this.word.word// flagged[id[0]].words.find(w => w.Id === id[1])
      console.log(word)
      const page = await pdf.getPage(word.Page)
      const { Height, Left, Top, Width } = word.Geometry.BoundingBox

      const scale = 3
      const viewport = page.getViewport({ scale })

      // Apply page dimensions to the <canvas> element.
      const canvas = this.$refs.pdf
      const context = canvas.getContext('2d')
      canvas.height = viewport.height * Height + 500
      canvas.width = viewport.width
      console.log(viewport)

      // Render the page into the <canvas> element.
      const renderContext = {
        canvasContext: context,
        viewport
      }

      context.imageSmoothingEnabled = false
      // context.scale(scale, scale)
      context.translate(0, 250 - viewport.height * Top)
      await page.render(renderContext).promise.then(_ => {
        context.fillStyle = '#FCDB03A2'
        context.fillRect(
          Left * canvas.width,
          Top * viewport.height,
          Width * canvas.width,
          Height * viewport.height
        )
      })

      this.loading = false
      console.log('Page rendered!')
    }
  }
}
</script>
