<template>
  <v-card-text>
    <v-row>
      <v-navigation-drawer permanent>
        <v-list>
          <v-list-item>
            Below confidence words
          </v-list-item>
          <v-divider />
          <v-list-group
            v-for="item in items"
            :key="item.title"
            v-model="item.active"
            prepend-icon="mdi-file"
            no-action
          >
            <template v-slot:activator>
              <v-list-item-content>
                <v-list-item-title v-text="item.name" />
              </v-list-item-content>
            </template>

            <v-list-item-group>
              <v-list-item v-for="(child, i) in item.children"
                           :key="i"
                           v-model="child.active"
                           @click="active = child.id"
              >
                <!-- <v-list-item-icon> -->
                <v-list-item-title v-text="child.name" />
                <v-list-item-icon @click="approve(child.id)">
                  <v-icon small color="green" v-text="'mdi-check'" />
                </v-list-item-icon>
                <v-list-item-icon @click="edit(child.id)">
                  <v-icon small color="primary" v-text="'mdi-pencil'" />
                </v-list-item-icon>
              </v-list-item>
            </v-list-item-group>
          </v-list-group>
        </v-list>
      </v-navigation-drawer>
      <v-col>
        <v-card>
          <v-card-text v-if="!file">
            Please select word from the list on the left
          </v-card-text>
          <v-row v-if="!!file">
            <v-col cols="12" xs="12">
              <v-breadcrumbs :items="parents" divider="\" />
            </v-col>
            <v-col cols="12" xs="12">
              <v-row align-xs="center">
                <v-btn text color="primary"><v-icon>mdi-arrow-left</v-icon></v-btn>
                <v-spacer />
                <v-btn text color="green" @click="approve(active)"><v-icon>mdi-check</v-icon></v-btn>
                <v-btn text color="primary" @click="edit(active)"><v-icon>mdi-pencil</v-icon></v-btn>
                <v-spacer />
                <v-btn text color="primary"><v-icon>mdi-arrow-right</v-icon></v-btn>
              </v-row>
            </v-col>
            <v-col cols="12" xs="12">
              Word detected: <span class="strong"> {{ active[2] }}</span>
            </v-col>
            <v-col>
              <v-card-text>
                <canvas ref="pdf" style="max-width: 100%; max-height: 500px" />
              </v-card-text>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-card-text>
</template>
<script>
import path from 'path'
import { getFlagedFiles, approveWord } from '@/scripts/reviews'
import { splitPath } from '@/scripts/utils'
import EditWord from '../../components/EditWord.vue'
const pdfjsLib = require('pdfjs-dist')

export default {
  layout: 'full',
  data: () => {
    return {
      active: null,
      open: [],
      flagged: {},
      items: []
    }
  },
  computed: {
    fileName () {
      if (!this.active) return undefined

      const id = this.active

      const flagged = this.flagged[id[0]]
      console.log('Selected ', id, flagged)
      if (!flagged || !flagged.extras) {
        return null
      }

      return flagged.extras.output
    },
    file () {
      if (!this.fileName) return undefined

      return `file://${this.fileName}`
    },
    parents () {
      return this.fileName ? splitPath(this.fileName, true) : []
    }
  },
  watch: {
    active () {
      this.drawPdf()
    },
    items (to) {
      this.active = to[0] ? to[0].children[0].id : null
    }
  },
  mounted () {
    this.reload()
  },
  methods: {
    reload () {
      getFlagedFiles()
        .then(flagged => {
          console.log(flagged)
          console.log(Object.values(flagged))
          this.flagged = flagged || {}
          return flagged
        })
        .then(flagged => {
          const res = Object.keys(flagged)
            .map((file, fi) => ({
              active: fi === 0,
              name: path.basename(file),
              children: flagged[file].words
                .map((w, i) =>
                  w ? { active: i === 0, id: [file, w.Id, w.Text], name: w.Text } : null
                )
            }))
          console.log(res)

          this.items = res
        })
    },
    async edit (id) {
      const result = await this.$dialog.showAndWait(EditWord, { word: id[2] })

      if (result && !result.cancel) {
        this.approve(id, result.update)
      }
    },
    async approve (id, newWord) {
      const res = await this.$dialog.confirm({
        text: newWord ? `Updating word to ${newWord} ` : `Approving word as correct!`,
        title: 'Are you sure?'
      })
      if (res) {
        approveWord(id[0], id[1], newWord)
          .then(_ => {
            this.$dialog.notify.success(`Updated word for ${id[0]}`)

            this.reload()
          })
      }
    },
    async drawPdf () {
      const id = this.active
      if (!id) {
        return
      }
      const loadingTask = pdfjsLib.getDocument(this.file)
      const pdf = await loadingTask.promise

      // Load information from the first page.
      const word = this.flagged[id[0]].words.find(w => w.Id === id[1])
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
      console.log('Page rendered!')
    }
  }
}
</script>
