/**
 * @license
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/IDuxFE/idux/blob/main/LICENSE
 */

import type { TableColumnMergedExpandable } from '../../composables/useColumns'
import type { FlattedData } from '../../composables/useDataSource'
import type { TableBodyRowProps, TableColumnExpandable } from '../../types'
import type { Slots, VNodeChild } from 'vue'

import { isFunction, isString } from 'lodash-es'

import BodyRow from './BodyRow'
import BodyRowSingle from './BodyRowSingle'

export function renderBodyRow(
  item: FlattedData,
  rowIndex: number,
  slots: Slots,
  expandable: TableColumnMergedExpandable | undefined,
  prefixCls: string,
): VNodeChild {
  const { children, expanded, level, hasPrevSibling, hasNextSibling, showLineIndentIndexList, record, rowKey } = item
  const rowProps = {
    key: rowKey,
    expanded,
    level,
    hasPrevSibling,
    hasNextSibling,
    showLineIndentIndexList,
    hasChildren: !!children?.length,
    record,
    rowData: item,
    rowIndex,
    rowKey,
  }
  const rowNode = <BodyRow {...rowProps} />

  const expandedNode = expanded && renderExpandedContext(rowProps, slots, expandable, prefixCls)
  return expandedNode ? [rowNode, expandedNode] : rowNode
}

function renderExpandedContext(
  props: TableBodyRowProps,
  slots: Slots,
  expandable: TableColumnExpandable | undefined,
  prefixCls: string,
) {
  const { customExpand } = expandable || {}
  const { record, rowIndex } = props
  let expandedContext: VNodeChild
  if (isFunction(customExpand)) {
    expandedContext = customExpand({ record, rowIndex })
  } else if (isString(customExpand) && slots[customExpand]) {
    expandedContext = slots[customExpand]!({ record, rowIndex })
  }
  return expandedContext && <BodyRowSingle class={`${prefixCls}-expanded-row`}>{expandedContext}</BodyRowSingle>
}
