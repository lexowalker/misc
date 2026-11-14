import type { Register, ThemeSetArgs } from 'claude-code'

import { problems, theme } from './look'
import { SCENE } from './scene'

const LOOK: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: {
    scene: 'winter-cabin',
    glass: { blur: 14, tint: '#1a120c', opacity: 0.55 },
  },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== 'winter-cabin') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={SCENE}
        alt="Inside a log cabin at night: snow falls on a moonlit pine forest and mountains beyond an arched window, and a fire crackles in a stone hearth"
        isInteractive
      />
    )
  })
}
