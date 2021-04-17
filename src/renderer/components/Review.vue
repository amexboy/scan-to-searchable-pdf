<template>
  <v-card :disabled="saving">
    <v-toolbar fixed>
      <v-row>
        <v-btn text small color="red" @click="close">
          <v-icon v-text="'mdi-close'" />
        </v-btn>
        <v-btn v-if="!autosave" text small :disabled="pending.length == 0" @click="save">
          <v-icon color="primary" v-text="'mdi-content-save'" />
        </v-btn>
        <!-- <v-btn text small>
          <v-icon v-text="'mdi-reload'" />
        </v-btn> -->
        <v-spacer />
        <v-btn text small color="green" @click="approveAllDialog">
          <v-icon v-text="'mdi-check-all'" /> &nbsp; Bulk Approve
        </v-btn>
        <v-btn text small color="red">
          <v-icon v-text="'mdi-lock-open'" /> &nbsp; Unlock
        </v-btn>
        <v-spacer />
        <v-btn-toggle v-model="view" mandatory>
          <v-btn text small value="12">
            <v-icon v-text="'mdi-cards-variant'" />
          </v-btn>
          <v-btn text small value="6">
            <v-icon v-text="'mdi-view-grid'" />
          </v-btn>
        </v-btn-toggle>
      </v-row>
    </v-toolbar>
    <v-card-text>
      <!-- <v-row>
        <v-breadcrumbs :items="parents" divider="\" />
      </v-row> -->

      <v-row v-if="ready && words.length > 0" style="max-height: 500px; overflow-y: scroll">
        <v-col v-for="word in words" :key="word.Id" cols="12" :sm="view">
          <v-card>
            <pdf-vue :word="word" @save="saveWord" />
          </v-card>
        </v-col>

        <v-col>
          <infinite-loading @infinite="scroll" />
          <template v-if="done">
            <v-row justify="center">
              You have reviewed all flagged words. Save?
            </v-row>
            <v-row justify="center">
              <v-btn small text><v-icon v-text="'mdi-content-save'" /> &nbsp; Save </v-btn>
              <v-btn small text><v-icon v-text="'mdi-reload'" /> &nbsp; Reset </v-btn>
            </v-row>
          </template>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
<script>
import { approveWord } from '@/scripts/reviews'
import EditWord from '@/components/EditWord.vue'
import ApproveConfidence from '@/components/ApproveConfidence.vue'
import { splitPath } from '@/scripts/utils'
import InfiniteLoading from 'vue-infinite-loading'
import PdfVue from '@/components/PdfVue.vue'

export default {
  components: { PdfVue, InfiniteLoading },
  props: {
    file: {
      type: Object,
      require: true,
      default: () => ({ words: [] })
    }
  },
  data () {
    return {
      originalWords: this.file.words.slice(),
      isActive: false,
      autosave: false,
      saving: false,
      ready: false,
      pending: [],
      view: 6,
      max: 5,
      search: '',
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
    words () {
      return this.originalWords.filter(w => !w.removed).slice(0, this.max)
    },
    parents () {
      return this.file.path ? splitPath(this.file.path, true) : []
    },
    done () {
      return this.ready && this.words.length === 0
    }
  },
  mounted () {
    this.ready = true
  },
  methods: {
    close () {
      Promise.resolve(this.pending.length > 0)
        .then(pending => {
          if (pending) {
            return this.$dialog.confirm({
              text: `You have ${this.pending.length} unsaved items. You will loose your changes`,
              title: 'Are you sure?'
            })
          }

          return true
        })
        .then(close => {
          if (close) {
            this.$emit('submit', { cancel: true })
            this.isActive = false
          }
        })
    },
    saveWord (data) {
      console.log(data)
      this.pending.push(data)
      this.removeFromWords(data.word)
    },
    removeFromWords (word) {
      const index = this.originalWords.indexOf(word)
      if (index >= 0) {
        this.originalWords.splice(index, 1)
      }
    },
    save () {
      this.saving = true
      Promise.all(this.pending.map(w => {
        return approveWord(w.word.path, w.word.Id, w.newWord)
      }))
        .then(_ => {
          this.$dialog.notify.success('Changes were succesfully saved')
          this.pending = []
        })
        .finally(_ => {
          this.saving = false
        })
        .then(_ => {
          if (this.words.length === 0) {
            this.close()
          }
        })
    },
    scroll ($state) {
      console.log('scroll')
      this.max += 5
      if (this.words.length === this.originalWords.length) {
        $state.complete()
      } else {
        $state.loaded()
      }
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
    async approveAllDialog () {
      this.saving = true
      const words = this.originalWords
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
              return approveWord(w.path, w.Id).then(_ => this.removeFromWords(w))
            })
          )
            .then(_ => {
              this.saving = false
              this.$dialog.notify.success(`Approved all words aboove set confidence`)
            })
        } else {
          this.saving = false
        }
      }
    }
  }
}
</script>
