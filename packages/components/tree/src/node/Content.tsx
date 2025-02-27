/**
 * @license
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/IDuxFE/idux/blob/main/LICENSE
 */

import type { TreeNode } from '../types'
import type { Slot } from 'vue'

import { computed, defineComponent, inject } from 'vue'

import { callEmit } from '@idux/cdk/utils'
import { IxIcon } from '@idux/components/icon'

import { treeToken } from '../token'
import { treeNodeContentProps } from '../types'

export default defineComponent({
  props: treeNodeContentProps,
  setup(props) {
    const {
      props: treeProps,
      mergedPrefixCls,
      mergedCheckOnClick,
      slots,
      handleSelect,
      handleCheck,
      searchedKeys,
    } = inject(treeToken)!

    const searched = computed(() => searchedKeys.value.includes(props.nodeKey))

    const onClick = (evt: Event) => {
      if (!props.disabled) {
        handleSelect(props.nodeKey)
        mergedCheckOnClick.value && handleCheck(props.node)
      }
      callEmit(treeProps.onNodeClick, evt, props.node.rawNode)
    }

    const onContextmenu = (evt: Event) => {
      callEmit(treeProps.onNodeContextmenu, evt, props.node.rawNode)
    }

    return () => {
      const { nodeKey, label, node, selected } = props
      const { rawNode } = node
      const { prefix, suffix } = rawNode

      const iconProps = { key: nodeKey, selected, node: rawNode }
      const prefixIcon = slots.prefix?.(iconProps) || (prefix && <IxIcon name={prefix} />)
      const suffixIcon = slots.suffix?.(iconProps) || (suffix && <IxIcon name={suffix} />)

      const prefixCls = `${mergedPrefixCls.value}-node-content`
      return (
        <span class={prefixCls} onClick={onClick} onContextmenu={onContextmenu}>
          {prefixIcon && <span class={`${prefixCls}-prefix`}>{prefixIcon}</span>}
          <span class={`${prefixCls}-label`}>
            {renderLabel(slots.label, label, rawNode, treeProps.searchValue, searched.value, prefixCls)}
          </span>
          {suffixIcon && <span class={`${prefixCls}-suffix`}>{suffixIcon}</span>}
        </span>
      )
    }
  },
})

function renderLabel(
  labelSlot: Slot | undefined,
  label: string | undefined,
  node: TreeNode,
  searchValue: string | undefined,
  searched: boolean,
  prefixCls: string,
) {
  if (labelSlot) {
    return labelSlot({ node, searchValue, searched })
  }
  if (searched && label && searchValue) {
    const startIndex = label.toUpperCase().indexOf(searchValue.toUpperCase())
    if (startIndex > -1) {
      const endIndex = startIndex + searchValue.length
      const beforeLabel = label.substring(0, startIndex)
      const afterLabel = label.substring(endIndex)
      const highlightLabel = <span class={`${prefixCls}-label-highlight`}>{label.substring(startIndex, endIndex)}</span>
      return [beforeLabel, highlightLabel, afterLabel]
    }
  }
  return label
}
