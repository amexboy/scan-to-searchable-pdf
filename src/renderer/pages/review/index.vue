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
          <v-row>
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
            <v-col>
              <pdf-vue v-if="active" :key="active.wordId" :word="active" />
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
import EditWord from '../../components/EditWord.vue'
import PdfVue from '../../components/PdfVue.vue'

export default {
  components: { PdfVue },
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
    words () {
      return this.items
        .flatMap(f => f.children).map(c => c.id).map(([file, wordId, text]) => ({ file, wordId, text }))
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
                  w ? { active: i === 0, id: { file, wordId: w.Id, text: w.Text, word: w, extras: flagged[file].extras }, name: w.Text } : null
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
    }
  }
}
</script>
