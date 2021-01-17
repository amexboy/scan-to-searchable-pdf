<template>
  <v-card-text>
    <v-toolbar flat>
      <v-spacer />

      <v-btn icon>
        <v-icon color="success" @click="newRootFolder">fa-plus</v-icon>
      </v-btn>
    </v-toolbar>

    <v-divider />
    <v-list>
      <v-list-group
        v-for="item in processes"
        :key="item.path"
        v-model="item.active"
        prepend-icon="fa-folder"
        no-action
      >
        <template v-slot:activator>
          <v-list-item-content>
            <v-list-item-title v-text="item.path" />
          </v-list-item-content>
        </template>

        <v-list-item>
          <v-text-field v-model="item.path" readonly label="Path" append-icon="fa-folder" />
        </v-list-item>
        <v-list-item>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field v-model="item.searchName" readonly label="Folder Search Name" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="item.original" readonly label="Original File Folder Name" />
            </v-col>
          </v-row>
        </v-list-item>
        <v-list-item>
          <v-btn text small>
            <v-icon small color="gray lighten-3">fa-file</v-icon> &nbsp;
            View Logs
          </v-btn>
          <v-spacer />
          <v-btn text small @click="edit(item)">
            <v-icon small color="primary">fa-pencil</v-icon> &nbsp;
            Edit
          </v-btn>
          <v-btn text small @click="remove(item._id)">
            <v-icon small color="red">fa-minus</v-icon> &nbsp;
            Delete
          </v-btn>
        </v-list-item>
      </v-list-group>
    </v-list>
    <v-dialog v-model="dialog" width="500px">
      <v-card>
        <v-toolbar
          color="primary"
          dark
        >
          {{ selected && selected.id? 'Edit': 'New' }} Scanned Path
        </v-toolbar>
        <v-card-text>
          <v-list>
            <v-list-item>
              Please select Root folder
            </v-list-item>

            <v-divider />

            <v-list-item>
              <v-text-field v-model="selected.path" readonly label="Path" @click="selectRoot(selected)" />
              <v-btn icon @click="selectRoot(selected)"><v-icon>fa-folder</v-icon></v-btn>
            </v-list-item>
            <v-list-item>
              <v-text-field v-model="selected.searchName" label="Folder Search Name" />
            </v-list-item>
            <v-list-item>
              <v-text-field v-model="selected.original" label="Original File Folder Name" />
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn color="red" text @click="dialog = false"><v-icon>fa-times</v-icon> &nbsp; Cancel</v-btn>
          <v-spacer />
          <v-btn :loading="processing"
                 color="primary" text @click="save"
          >
            <v-icon>fa-check</v-icon> &nbsp; Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card-text>
</template>

<script>
import { remote } from 'electron'
const path = remote.require('path')
const { dialog } = remote

export default {
  data () {
    return {
      processes: [],
      processing: false,
      selected: { path: '' },
      dialog: false,
      rootFolder: null
    }
  },
  mounted () {
    this.reload()
  },
  methods: {
    reload () {
      this.$store.state.paths.find({})
        .then(p => {
          console.log(p)
          this.processes = p
        })
    },
    save () {
      this.processing = true
      // this.processes.push(this.selected)
      this.$store.commit('path', this.selected)
      this.reload()
      this.dialog = false
      this.processing = false
    },
    remove (id) {
      this.$store.state.paths.remove({ _id: id })
      this.reload()
    },
    selectRoot (ob) {
      const defaultPath = (typeof ob === 'object') ? ob.path : ''

      dialog.showOpenDialog({ defaultPath, properties: ['openDirectory'] })
        .then(res => {
          if (res.canceled) {
            console.log('File selection canceled')
            return defaultPath
          }

          return res.filePaths[0]
        })
        .then(p => {
          return path.resolve(p)
        })
        .then(p => {
          console.log(p)
          ob.path = p
        })
    },
    edit (row) {
      this.dialog = true
      this.selected = row
    },
    newRootFolder () {
      this.dialog = true
      this.selected = { path: '' }
    }
  }

}
</script>
