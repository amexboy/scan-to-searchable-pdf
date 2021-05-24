<template>
  <v-card :loading="loading" :disabled="approved || !editable">
    <v-row>
      <v-col cols="12" sm="6">
        <v-list dense two-line subheader>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-subtitle>
                Word detected
              </v-list-item-subtitle>
              <v-list-item-title v-text="word.Text" />
              <v-list-item-subtitle>
                ({{ parseFloat(word.Confidence).toFixed(2) }}% confidence)
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-subtitle>
                Page
              </v-list-item-subtitle>
              <v-list-item-title v-text="word.Page" />
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-col>
      <v-col cols="12" sm="5">
        <v-textarea v-model="newWord"
                    label="Update"
                    :rules="[i => !!i || 'Required']"
                    append-outer-icon="mdi-check"
                    @click:append-outer="save"
        />
      </v-col>
      <v-col cols="12" xs="12">
        <canvas ref="pdf" style="max-width: 100%; max-height: 500px" />
      </v-col>
    </v-row>
  </v-card>
</template>
<script>

export default {
  props: {
    path: {
      type: String,
      require: true,
      default: ''
    },
    pdf: {
      type: Object,
      required: true
    },
    word: {
      type: Object,
      required: true
    },
    scale: {
      type: Number,
      required: false,
      default: 3
    },
    editable: {
      type: Boolean
    }
  },
  data () {
    return {
      approved: false,
      loading: true,
      newWord: this.word.Text
    }
  },
  mounted () {
    setTimeout(() => this.drawPdf(this.word), 300)
  },
  methods: {
    save () {
      this.approved = true
      this.$emit('save', { file: this.path, word: this.word, newWord: this.newWord })
    },
    async drawPdf (id) {
      if (!id) {
        return
      }

      const pdf = this.pdf

      // Load information from the first page.
      const word = this.word
      const page = await pdf.getPage(word.Page)
      const { Height, Left, Top, Width } = word.Geometry.BoundingBox

      const scale = this.scale
      const viewport = page.getViewport({ scale })

      // Apply page dimensions to the <canvas> element.
      const canvas = this.$refs.pdf
      const context = canvas.getContext('2d')
      canvas.height = viewport.height * Height + 200
      canvas.width = viewport.width

      // Render the page into the <canvas> element.
      const renderContext = {
        canvasContext: context,
        viewport
      }

      context.imageSmoothingEnabled = false
      // context.scale(scale, scale)
      context.translate(0, 100 - viewport.height * Top)
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
