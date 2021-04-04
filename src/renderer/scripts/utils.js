import { remote } from 'electron'
const path = remote.require('path')

export const splitPath = (p, removeFile = false) => {
  if (removeFile) {
    p = path.dirname(p)
  }
  console.log(p)
  function evalPath (p) {
    const parent = path.dirname(p)
    if (!p || p === parent) return [p]
    return [...evalPath(parent), p]
  }

  return evalPath(p)
    .map(p => {
      return { text: path.basename(p) || 'root', to: '/browse/' + p, exact: true }
    })
}
