import { makeColors } from './make-colors.js'

// Timber, smoke and embers by night: a cabin lit by its hearth.
export const { theme, problems } = makeColors({
  label: 'Winter cabin',
  only: 'dark',
  roles: {
    accent: '#e08a3c', // ember
    danger: '#c4503a', // hot coal
    success: '#6f9a63', // pine
    warning: '#d9b44a', // candle gold
    pro: '#8e9fd6', // moonlit frost
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#16100c',
        'surface-1': '#1d1610',
        'surface-2': '#241b14',
        'surface-3': '#2a2018',
        'text-primary': '#f3e8d6',
        'text-secondary': '#d3c4ad',
        'text-muted': '#ad9d86',
      },
    },
  },
})
