import { dbFactory } from '@/scripts/db'

export const state = () => ({
  paths: dbFactory('continious-process.db')
})

export const mutations = {
  path (state, pathInfo) {
    console.log(pathInfo)
    if (pathInfo._id) {
      state.paths.update({ _id: pathInfo._id }, pathInfo)
    } else {
      state.paths.insert(pathInfo)
    }
  }
}
