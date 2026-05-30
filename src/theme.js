const KEY = 'theme'

export function getTheme() {
  return localStorage.getItem(KEY) || 'system'
}

export function applyTheme(theme) {
  localStorage.setItem(KEY, theme)
  const dark =
    theme === 'dark' ||
    (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
