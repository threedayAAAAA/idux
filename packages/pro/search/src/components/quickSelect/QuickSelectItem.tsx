/**
 * @license
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/IDuxFE/idux/blob/main/LICENSE
 */

import type { SearchState } from '../../composables/useSearchStates'

import { computed, defineComponent, inject, normalizeClass, ref, watch } from 'vue'

import { isNil, isObject } from 'lodash-es'

import { Logger, callEmit, useState } from '@idux/cdk/utils'
import { type IconInstance, IxIcon } from '@idux/components/icon'
import { IxInput } from '@idux/components/input'

import { proSearchContext } from '../../token'
import { type SearchDataTypes, quickSelectPanelItemProps, searchDataTypes } from '../../types'

export default defineComponent({
  props: quickSelectPanelItemProps,
  setup(props, { slots }) {
    const {
      props: proSearchProps,
      mergedPrefixCls,
      convertStateToValue,
      createSearchState,
      getSearchStatesByFieldKey,
      removeSearchState,
      updateSegmentValue,
      updateSearchValues,
      tempSegmentInputRef,
    } = inject(proSearchContext)!

    const searchInputRef = ref<HTMLInputElement>()
    const searchIconRef = ref<IconInstance>()

    const [searchInput, setSearchInput] = useState('')
    const [searchInputOpend, _setSearchInputOpened] = useState(false)
    const setSearchInputOpened = (opened: boolean) => {
      _setSearchInputOpened(opened)
      if (opened) {
        searchInputRef.value?.focus()
      } else {
        tempSegmentInputRef.value?.focus()
      }
    }

    const quickSelectSearchable = computed(() => {
      if (isObject(props.searchField.quickSelect)) {
        return props.searchField.quickSelect.searchable
      }

      if (props.searchField.quickSelectSearchable) {
        Logger.warn('pro/search', '`quickSelectSearchable` is deprecated, use `quickSelect.searchable` instead')
        return true
      }

      return false
    })
    const searchBarCls = computed(() => {
      const prefixCls = `${mergedPrefixCls.value}-quick-select-item-search-bar`
      return normalizeClass({
        [prefixCls]: true,
        [`${prefixCls}-opened`]: searchInputOpend.value,
      })
    })

    const searchState = computed<SearchState | undefined>(() => getSearchStatesByFieldKey(props.searchField.key)[0])
    const searchDataSegment = computed(() =>
      props.searchField.segments.find(seg => searchDataTypes.includes(seg.name as SearchDataTypes)),
    )
    const searchDataSegmentState = computed(
      () => searchState.value?.segmentStates.find(seg => searchDataTypes.includes(seg.name as SearchDataTypes)),
    )

    const [itemValue, setItemValue] = useState<unknown>(searchDataSegmentState.value?.value)
    watch(() => searchDataSegmentState.value?.value, setItemValue)

    const confirmValue = (value: unknown) => {
      let searchStateKey = searchState.value?.key

      if (isNil(value) && searchStateKey) {
        removeSearchState(searchStateKey)
        return
      }

      if (!searchState.value) {
        searchStateKey = createSearchState(props.searchField.key, {
          value,
        })!.key
        callEmit(proSearchProps.onItemCreate, {
          ...convertStateToValue(searchStateKey),
          nameInput: props.searchField.label,
        })
      } else if (searchDataSegment.value?.name) {
        updateSegmentValue(searchState.value.key, searchDataSegment.value.name, value)
      }

      updateSearchValues()
    }
    const setValue = (value: unknown) => {
      setItemValue(value)
    }
    const ok = () => confirmValue(itemValue.value)
    const cancel = () => {
      setItemValue(searchDataSegmentState.value?.value)
    }
    const setOnKeyDown = () => {}

    const handleBlur = () => {
      setSearchInput('')
      setSearchInputOpened(false)
    }
    const handleSearchIconClick = () => {
      setSearchInputOpened(!searchInputOpend.value)
    }
    const handleSearchIconMouseDown = (evt: MouseEvent) => {
      evt.preventDefault()
      evt.stopImmediatePropagation()
    }

    return () => {
      const prefixCls = `${mergedPrefixCls.value}-quick-select-item`
      const classes = normalizeClass([prefixCls, ...(searchDataSegment.value?.containerClassName ?? [])])
      return (
        <div class={classes}>
          <div class={`${prefixCls}-header`}>
            <label class={`${prefixCls}-label`}>{props.searchField.label}</label>
            {quickSelectSearchable.value && (
              <div class={searchBarCls.value}>
                <IxInput
                  ref={searchInputRef}
                  class={`${prefixCls}-search-input`}
                  value={searchInput.value}
                  onBlur={handleBlur}
                  onChange={setSearchInput}
                  borderless
                />
                <IxIcon
                  ref={searchIconRef}
                  class={`${prefixCls}-search-icon`}
                  name="search"
                  onMousedown={handleSearchIconMouseDown}
                  onClick={handleSearchIconClick}
                />
              </div>
            )}
          </div>
          <div class={`${prefixCls}-content`}>
            {searchDataSegment.value?.panelRenderer?.({
              slots,
              input: searchInput.value,
              value: itemValue.value,
              states: searchState.value?.segmentStates ?? [],
              renderLocation: 'quick-select-panel',
              ok,
              cancel,
              setValue,
              setOnKeyDown,
            })}
          </div>
        </div>
      )
    }
  },
})
