<template>
  <v-card-text>
    <v-col>
      <v-card>
        <v-data-table
          :headers="headers"
          :items="files"
          :search="search"
          single-expand
          show-expand
        >
          <template #top>
            <v-toolbar flat>
              <v-toolbar-title>Flagged Files</v-toolbar-title>
              <v-spacer />
              <v-text-field
                v-model="search"
                append-icon="mdi-magnify"
                label="Search"
                single-line
                hide-details
              />
            </v-toolbar>
          </template>
          <template #item.actions="{ item }">
            <v-row>
              <!-- <v-btn small text color="red"><v-icon>mdi-lock</v-icon></v-btn> -->
              <!-- <v-btn small text color="green" @click="approveAllDialog(item.words)">
                <v-icon>mdi-check</v-icon></v-btn> -->
              <v-btn small text color="primary" @click="review(item)"><v-icon>mdi-eye-outline</v-icon></v-btn>
            </v-row>
          </template>
          <template #expanded-item="{ item }">
            <td :colspan="headers.length">
              <v-list
                dense
                subheader
                two-line
              >
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-subtitle v-text="'Path'" />
                    <v-list-item-title v-text="item.path" />
                  </v-list-item-content>
                </v-list-item>

                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-subtitle v-text="'Input'" />
                    <v-list-item-title v-text="item.input" />
                  </v-list-item-content>
                </v-list-item>

                <v-list-item>
                  <!-- <v-btn small text color="green" @click="approveAllDialog(item.words)"> -->
                  <!-- <v-icon v-text="'mdi-check'" />&nbsp; Bulk Approve -->
                  <!-- </v-btn> -->
                  <v-btn small text color="primary" @click="review(item)">
                    <v-icon v-text="'mdi-eye-outline'" />&nbsp; Review
                  </v-btn>
                  <v-spacer />
                  <!-- <v-btn small text color="green"><v-icon v-text="'mdi-lock'" />&nbsp; Aquire Lock</v-btn>
                  <v-btn small text color="red"><v-icon v-text="'mdi-lock-open'" />&nbsp; Release Lock</v-btn> -->
                </v-list-item>
              </v-list>
            </td>
          </template>
        </v-data-table>
      </v-card>
    </v-col>
  </v-card-text>
</template>
<script>
import path from 'path'
import { getFlagedFiles, approveWord } from '@/scripts/reviews'
import EditWord from '@/components/EditWord.vue'
import ApproveConfidence from '@/components/ApproveConfidence.vue'
import Review from '@/components/Review.vue'

export default {
  data: () => {
    return {
      search: '',
      flagged: {},
      headers: [{ text: 'File Name', value: 'name' },
        { text: 'Flagged Words', value: 'wordsCount' },
        { text: 'Actions', value: 'actions', sortable: false }
        // { text: 'Path', value: 'path' },
        // { text: 'Input', value: 'input' },
        // { text: 'Output', value: 'output' }
      ]
    }
  },
  computed: {
    files () {
      const flagged = this.flagged
      const res = Object.keys(flagged)
        .map((file, fi) => ({
          name: path.basename(file),
          path: file,
          wordsCount: flagged[file].words.length,
          words: flagged[file].words,
          input: flagged[file].extras.originalPath || file,
          output: flagged[file].extras.output

        }))
      console.log(res)

      return res
    }
  },
  watch: {
    items (to) {
      this.active = to[0] ? to[0].children[0].id : null
    }
  },
  mounted () {
    this.reload()
  },
  methods: {
    async review (file) {
      await this.$dialog.showAndWait(Review, { layout: 'dialog', width: '90%', persistent: true, file })
      this.reload()
    },
    reload () {
      getFlagedFiles()
        .then(flagged => {
          console.log(flagged)
          console.log(Object.values(flagged))
          this.flagged = flagged || {}
          return flagged
        })
    },
    async edit (id) {
      const result = await this.$dialog.showAndWait(EditWord, { word: id.text })

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
        approveWord(id.file, id.wordId, newWord)
          .then(_ => {
            this.$dialog.notify.success(`Updated word for ${id.file}`)

            this.reload()
          })
      }
    },
    async approveAllDialog (words) {
      const result = await this.$dialog.showAndWait(ApproveConfidence, { confidence: 1 })
      if (result && !result.cancel) {
        const confidence = words.filter(w => w.Confidence > result.confidence)
        console.log('Words above confidence', confidence)

        const res = await this.$dialog.confirm({
          text: `Approve ${confidence.length} words above ${result.confidence}% confidence`,
          title: 'Are you sure?'
        })
        if (res) {
          Promise.all(
            confidence.map(w => {
              return approveWord(w.path, w.Id)
            })
          )
            .then(_ => {
              this.$dialog.notify.success(`Approved all words aboove set confidence`)

              this.reload()
            })
        }
      }
    }
  }
}
</script>
