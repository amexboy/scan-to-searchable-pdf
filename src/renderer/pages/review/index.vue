<template>
  <v-card-text>
    <v-row>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <v-treeview
              :active.sync="active"
              :items="items"
              :open.sync="open"
              activatable
              color="warning"
              open-on-click
              transition
            >
              <template v-slot:prepend="{ item }">
                <v-icon v-if="!item.children">
                  mdi-account
                </v-icon>
              </template>
            </v-treeview>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="9">
        <v-card>
          <v-card-text>List</v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-card-text>
</template>
<script>
import { getFlagedFiles } from '@/scripts/reviews'
export default {
  layout: 'full',
  data: () => {
    return {
      active: [],
      open: [],
      flagged: {}
    }
  },
  computed: {
    items () {
      const res = Object.keys(this.flagged)
        .map(file => ({
          name: file,
          children: this.flagged[file].words.map(w => w ? { id: w.Id, name: w.Text } : null)
        }))
      console.log(res)

      return res
    }
  },
  mounted () {
    getFlagedFiles().then(flagged => {
      console.log(flagged)
      console.log(Object.values(flagged))
      this.flagged = flagged || {}
    })
  }

}
</script>
