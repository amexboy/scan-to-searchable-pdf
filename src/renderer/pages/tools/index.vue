<template>
  <v-card-text>
    <v-toolbar flat>
      <v-spacer />

      <v-btn text @click="newRootFolder">
        <v-icon color="success">fa-plus</v-icon> &nbsp; Add Scanned Path
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
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field v-model="item.path" readonly
                            label="Path" append-outer-icon="fa-folder" @click="edit(item)"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="item.result" readonly
                            label="Results File Folder Name" @click="edit(item)"
              />
            </v-col>
          </v-row>
        </v-list-item>
        <v-list-item>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field v-model="item.search" readonly
                            label="Folder Search Name" @click="edit(item)"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="item.original" readonly
                            label="Original File Folder Name" @click="edit(item)"
              />
            </v-col>
          </v-row>
        </v-list-item>
        <v-list-item>
          <v-btn text small @click="logs(item)">
            <v-icon small color="gray lighten-3">fa-file</v-icon> &nbsp;
            View Logs
          </v-btn>
          <v-spacer />
          <v-btn text small @click="edit(item)">
            <v-icon small color="primary">fa-pencil</v-icon> &nbsp;
            Edit
          </v-btn>
          <v-btn text small @click="remove(item)">
            <v-icon small color="red">fa-minus</v-icon> &nbsp;
            Delete
          </v-btn>
        </v-list-item>
      </v-list-group>
    </v-list>
    <v-dialog v-model="dialog" width="500px">
      <v-form ref="form">
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
                <v-text-field v-model="selected.path" readonly label="Path"
                              :rules="[i => !!i || 'Required']"
                              append-outer-icon="fa-folder" @click:append-outer="selectRoot(selected)"
                              @click="selectRoot(selected)"
                />
              </v-list-item>
              <v-list-item>
                <v-text-field v-model="selected.result"
                              :rules="[i => !!i || 'Required',
                                       i => i !== selected.search || 'Result and Search Folders Cannot be the same']"
                              label="Folder Search Name"
                />
              </v-list-item>
              <v-list-item>
                <v-text-field v-model="selected.search"
                              :rules="[i => !!i || 'Required',
                                       i => i !== selected.original || 'Original & Search Folders Can\'t be the same']"
                              label="Folder Search Name"
                />
              </v-list-item>
              <v-list-item>
                <v-text-field v-model="selected.original"
                              :rules="[i => !!i || 'Required',
                                       i => i !== selected.result || 'Result and Search Folders Can\'t be the same',
                                       i => i !== selected.search || 'Original and Search Folders Can\'t be the same']"
                              label="Original File Folder Name"
                />
              </v-list-item>
            </v-list>
          </v-card-text>
          <v-card-actions class="justify-end">
            <v-spacer />
            <v-btn :loading="processing"
                   color="primary" text @click="save"
            >
              <v-icon small>fa-check</v-icon> &nbsp; Save
            </v-btn>
            <v-btn color="red" text @click="dialog = false"><v-icon small>fa-times</v-icon> &nbsp; Cancel</v-btn>
          </v-card-actions>
        </v-card>
      </v-form>
    </v-dialog>
  </v-card-text>
</template>

<script>
import { remote } from 'electron'
import { dbFactory } from '@/scripts/db'

const paths = dbFactory('continious-process.db')
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
      paths.find({})
        .then(p => {
          console.log(p)
          this.processes = p
        })
    },
    save () {
      this.processing = true
      if (!this.$refs.form.validate()) {
        this.processing = false
        return
      }
      // this.processes.push(this.selected)
      paths.update({ _id: this.selected._id }, this.selected, { upsert: true })
        .then(_ => {
          this.reload()
          this.dialog = false
          this.processing = false
        })
    },
    remove (item) {
      paths.remove({ _id: item._id, path: item.path })
        .then(_ => {
          this.reload()
        })
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
    async logs (item) {
      const logs = await this.$store.state.logs.find({ path: item.path })
      console.log(logs)

      this.$dialog.info({
        text: '<v-list>' + logs.map(p =>
          `<v-list-item-group>${p.text}</v-list-item-group>`
        ).join('\n') + '</v-list>',
        title: 'Logs'
      })
    },
    edit (row) {
      this.dialog = true
      this.selected = row
    },
    newRootFolder () {
      this.dialog = true
      this.selected = { path: '', search: '*', original: 'Originals', result: 'Results' }
    }
  }

}
</script>
