/**
 * @license
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/IDuxFE/idux/blob/main/LICENSE
 */

import type { CertainThemeTokens, GlobalThemeTokens } from '@idux/components/theme'
export function getDefaultThemeTokens(tokens: GlobalThemeTokens): CertainThemeTokens<'tabs'> {
  const { fontSizeSm, fontSizeMd, paddingSizeLg, heightMd, heightLg, borderRadiusSm } = tokens

  return {
    navFontSizeMd: fontSizeSm,
    navFontSizeLg: fontSizeMd,

    navTabPadding: `0 ${paddingSizeLg}px`,
    navTabMinWidth: 72,
    navTabHeight: heightLg,
    navBarHeight: 2,

    segmentNavHeight: heightMd,

    borderRadius: borderRadiusSm,
    panelPaddingSize: paddingSizeLg,
  }
}
