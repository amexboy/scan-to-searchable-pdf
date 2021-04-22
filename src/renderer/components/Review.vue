<template>
  <v-card :loading="!ready || saving" :disabled="!ready || saving">
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
        <v-btn text small color="green" :disabled="!editable" @click="approveAllDialog">
          <v-icon v-text="'mdi-check-all'" /> &nbsp; Bulk Approve
        </v-btn>
        <v-btn v-if="ready && editable && !hasLock" text small color="red"
               @click="forceLock"
        >
          <v-icon v-text="'mdi-lock-open'" /> &nbsp; Force Aqquire Lock
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
            <pdf-vue :editable="editable" :word="word" :path="file.path" @save="saveWord" />
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
import { lock, approveWords, getFlaggedWords } from '@/scripts/reviews'
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
    },
    editable: {
      type: Boolean
    }
  },
  data () {
    return {
      originalWords: [],
      corrections: [],
      isActive: false,
      autosave: false,
      saving: false,
      ready: false,
      pending: [],
      hasLock: false,
      view: 6,
      max: 5,
      search: '',
      headers: [{ text: 'File Name', value: 'name' },
        { text: 'Flagged Words', value: 'wordsCount' },
        { text: 'Actions', value: 'actions', sortable: false }
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
    },
    canEdit () {
      return this.editable && this.hasLock
    }
  },
  mounted () {
    const init = this.editable ? this.aqquireLock(false) : Promise.resolve(false)
    init.then(async () => {
      const res = await getFlaggedWords(this.file.path, 0)
      this.ready = true
      this.originalWords = res.words
      this.correctons = res.correctons
    })
  },
  methods: {
    forceLock () {
      this.aqquireLock(true)
    },
    aqquireLock (force) {
      this.saving = true
      return lock(this.file.path, force)
        .then(({ success }) => {
          this.hasLock = success
        })
        .catch(err => {
          this.hasLock = false
          this.$dialog.notify.warning('Unable to aquire lock: ' + err.message)
        })
        .finally(_ => {
          this.saving = false
        })
    },
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
      if (!this.editable) {
        return
      }
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
      return approveWords(this.file.path, this.pending)
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
      } else {
        this.saving = false
      }
    }
  }
}
</script>
