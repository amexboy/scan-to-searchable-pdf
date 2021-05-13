<template>
  <v-card-text>
    <v-list-item>
      Configure
    </v-list-item>
    <v-divider />

    <v-list>
      <v-list-item-group
        color="primary"
      >
        <v-list-item>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field v-model="bucketName" :rules="[ i => !!i || 'You must set Bucket name']"
                            hint="Files will be uploaded to S3 to be processed!"
                            label="Bucket name"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="region" :rules="[ i => !!i || 'You must choose a region']"
                            hint="Choose an AWS region for calling AWS services"
                            label="AWS Region"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="apiKeyId" hint="Will be used to authenticate with AWS"
                            label="AWS API Key Id"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="apiKeySecret" hint="Will be used to authenticate with AWS"
                            label="AWS API Key Secret"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="appId" hint="App Id used for locking files for review"
                            label="App id"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="confidence" hint="The minimum confidence to decide to flag words for review"
                            label="Min confidence"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="onedriveAuthStatus" disabled label="One Drive Authentication" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-btn text :loading="processing" color="green" @click="login">
                <v-icon>mdi-account</v-icon> &nbsp; Login
              </v-btn>
            </v-col>
          </v-row>
        </v-list-item>
      </v-list-item-group>
      <v-list-item>
        <v-spacer />
        <v-btn text :loading="processing" color="primary" @click="save">
          <v-icon>mdi-content-save</v-icon> &nbsp; Save
        </v-btn>
      </v-list-item>
    </v-list>
  </v-card-text>
</template>

<script>
import { setAwsAccess, getCredential, getConfig, setConfig } from '@/scripts/db'
import { getToken } from '@/scripts/onedrive'

export default {
  data () {
    return {
      onedriveAuthStatus: '',
      processing: false,
      bucketName: '',
      confidence: '',
      appId: '',
      region: '',
      apiKeyId: '',
      apiKeySecret: '',
      allowedTypes: ['.png', '.jpg', '.jpeg', '.pdf']
    }
  },
  mounted () {
    getConfig('bucket_name', '')
      .then(name => {
        console.log(name)
        this.bucketName = name
      })
    getConfig('confidence', 99)
      .then(confidence => {
        console.log(confidence)
        this.confidence = confidence
      })
    getConfig('app_id')
      .then(appId => {
        console.log(appId)
        this.appId = appId
      })
    getConfig('onedrive_auth')
      .then(config => {
        console.log(config)
        this.onedriveAuthStatus = this.activeStatus(config)
      })
    getCredential().then(config => {
      console.log(config)
      this.apiKeyId = config.credentials ? config.credentials.accessKeyId : ''
      this.apiKeySecret = config.credentials ? config.credentials.secretAccessKey : ''
      this.region = config.region
    })
  },
  methods: {
    login () {
      getToken().then(r => {
        console.log('Token response', r)
      })
    },
    activeStatus (config) {
      if (!config) {
        return 'Not Configured'
      }

      return 'Active'
    },
    save () {
      this.processing = true
      Promise.all([
        setConfig('bucket_name', this.bucketName),
        setAwsAccess(this.apiKeyId, this.apiKeySecret, this.region),
        setConfig('confidence', this.confidence),
        setConfig('app_id', this.appId)

      ])
        .then(_ => {
          this.processing = false
        })
    }
  }
}
</script>
