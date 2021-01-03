export default function ({ store, redirect }) {
  // automatic redirect
  const previousPath = window.localStorage.getItem('start_path')
  if (previousPath) {
    return redirect(`/browse/${previousPath}`)
  }
  return redirect('/browse/./')
}
