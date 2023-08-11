/**
 * @license
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/IDuxFE/idux/blob/main/LICENSE
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type ComputedRef,
  type Ref,
  type ShallowRef,
  type WatchCallback,
  type WatchOptions,
  type WatchStopHandle,
  computed,
  nextTick,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from 'vue'

import { isArray, isFunction, isNil, isPlainObject, isString } from 'lodash-es'

import { convertArray } from '@idux/cdk/utils'

import {
  type AsyncValidatorFn,
  type ValidateError,
  type ValidateErrors,
  type ValidateStatus,
  type ValidatorFn,
  type ValidatorOptions,
} from '../types'
import { Validators, addValidators, hasValidator, removeValidators } from '../validators'

export type IsNullable<T, K> = undefined extends T ? K : never

export type OptionalKeys<T> = { [K in keyof T]-?: IsNullable<T[K], K> }[keyof T]

export type ArrayElement<A> = A extends (infer T)[] ? T : never

export type GroupControls<T> = {
  [K in keyof T]: AbstractControl<T[K]>
}

export type ControlPathType = string | number | Array<string | number>

function isOptions(val?: ValidatorFn | ValidatorFn[] | ValidatorOptions): val is ValidatorOptions {
  return isPlainObject(val)
}

function toValidator(validator?: ValidatorFn | ValidatorFn[]): ValidatorFn | undefined {
  return isArray(validator) ? Validators.compose(validator) : validator
}

function toAsyncValidator(asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[]): AsyncValidatorFn | undefined {
  return isArray(asyncValidator) ? Validators.composeAsync(asyncValidator) : asyncValidator
}

let controlId = 0
export abstract class AbstractControl<T = any> {
  readonly uid: number = controlId++
  /**
   * A collection of child controls.
   */
  readonly controls!: ComputedRef<any>

  /**
   * The ref value for the control.
   */
  readonly valueRef!: ComputedRef<T>

  /**
   * The validation status of the control, there are three possible validation status values:
   * * **valid**: This control has passed all validation checks.
   * * **invalid**: This control has failed at least one validation check.
   * * **validating**: This control is in the midst of conducting a validation check.
   */
  readonly status!: ComputedRef<ValidateStatus>

  /**
   * An object containing any errors generated by failing validation, or undefined if there are no errors.
   */
  readonly errors!: ComputedRef<ValidateErrors | undefined>

  /**
   * A control is valid when its `status` is `valid`.
   */
  readonly valid!: ComputedRef<boolean>

  /**
   * A control is invalid when its `status` is `invalid`.
   */
  readonly invalid!: ComputedRef<boolean>

  /**
   * A control is validating when its `status` is `validating`.
   */
  readonly validating!: ComputedRef<boolean>

  /**
   * A control is validating when its `status` is `disabled`.
   */
  readonly disabled!: ComputedRef<boolean>

  /**
   * A control is marked `blurred` once the user has triggered a `blur` event on it.
   */
  readonly blurred!: ComputedRef<boolean>

  /**
   * A control is `unblurred` if the user has not yet triggered a `blur` event on it.
   */
  readonly unblurred!: ComputedRef<boolean>

  /**
   * A control is `dirty` if the user has changed the value in the UI.
   */
  readonly dirty!: ComputedRef<boolean>

  /**
   * A control is `pristine` if the user has not yet changed the value in the UI.
   */
  readonly pristine!: ComputedRef<boolean>

  /**
   * The parent control.
   */
  get parent(): AbstractControl | undefined {
    return this._parent
  }

  /**
   * Retrieves the top-level ancestor of this control.
   */
  get root(): AbstractControl<T> {
    let root = this as AbstractControl<T>

    while (root.parent) {
      root = root.parent
    }

    return root
  }

  /**
   * Reports the trigger validate of the `AbstractControl`.
   * Possible values: `'change'` | `'blur'` | `'submit'`
   * Default value: `'change'`
   */
  get trigger(): 'change' | 'blur' | 'submit' {
    return this._trigger ?? this._parent?.trigger ?? 'change'
  }

  name?: string
  example?: string

  protected _controls: ShallowRef<any>
  protected _valueRef!: ShallowRef<T>
  protected _status!: Ref<ValidateStatus>
  protected _controlsStatus!: Ref<ValidateStatus>
  protected _errors!: ShallowRef<ValidateErrors | undefined>
  protected _disabled!: Ref<boolean>
  protected _disabledFn?: (control: AbstractControl, initializing: boolean) => boolean
  protected _blurred = ref(false)
  protected _dirty = ref(false)
  protected _initializing = ref(true)

  private _validators: ValidatorFn | ValidatorFn[] | undefined
  private _composedValidators: ValidatorFn | undefined
  private _asyncValidators: AsyncValidatorFn | AsyncValidatorFn[] | undefined
  private _composedAsyncValidators: AsyncValidatorFn | undefined
  private _parent: AbstractControl<T> | undefined
  private _trigger?: 'change' | 'blur' | 'submit'

  constructor(
    controls?: GroupControls<T> | AbstractControl<ArrayElement<T>>[],
    validatorOrOptions?: ValidatorFn | ValidatorFn[] | ValidatorOptions,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[],
    initValue?: T,
  ) {
    this._controls = shallowRef(controls)
    this._valueRef = shallowRef(initValue ?? this._calculateInitValue())
    this._forEachControls(control => control.setParent(this))
    this._convertOptions(validatorOrOptions, asyncValidator)
    this._init()
  }

  /**
   * Sets a new value for the control.
   *
   * @param value The new value.
   * @param options
   * * `dirty`: Marks it dirty, default is `false`.
   * * `blur`: Marks it blurred, default is `false`.
   */
  abstract setValue(
    value: T | Partial<T> | Partial<ArrayElement<T>>[],
    options?: { dirty?: boolean; blur?: boolean },
  ): void

  /**
   * The aggregate value of the control.
   *
   * @param options
   * * `skipDisabled`: Ignore value of disabled control, default is `false`.
   */
  abstract getValue(options?: { skipDisabled?: boolean }): T

  protected abstract _calculateInitValue(): T
  protected abstract _forEachControls(cb: (v: AbstractControl, k: keyof T) => void): void
  protected abstract _find(name: string | number): AbstractControl | undefined

  /**
   * Resets the control, marking it `unblurred` `pristine`, and setting the value to initialization value.
   */
  reset(): void {
    if (this._controls.value) {
      this._forEachControls(control => control.reset())
    } else {
      const currValue = this._valueRef.value
      const initValue = this._calculateInitValue()
      if (currValue !== initValue) {
        this._valueRef.value = initValue
      } else {
        // There are cases where the value does not change but the validator changes,
        // so manual validation is required here
        this._validate()
      }
      this.markAsUnblurred()
      this.markAsPristine()
    }
  }

  /**
   * Running validations manually, rather than automatically.
   */
  async validate(): Promise<ValidateErrors | undefined> {
    if (!this._disabled.value && this._controls.value) {
      const validates: Promise<ValidateErrors | undefined>[] = []
      this._forEachControls(control => validates.push(control.validate()))
      if (validates.length > 0) {
        await Promise.all(validates)
      }
    }
    return this._validate()
  }

  /**
   * Marks the control as `disable`.
   */
  disable(): void {
    this._disabled.value = true
    this._errors.value = undefined

    if (this._controls.value) {
      this._forEachControls(control => control.disable())
    }
  }

  /**
   * Enables the control,
   */
  enable(): void {
    this._disabled.value = false

    if (this._controls.value) {
      this._forEachControls(control => control.enable())
    }

    this._validate()
  }

  /**
   * Marks the control as `blurred`.
   */
  markAsBlurred(): void {
    if (this._controls.value) {
      this._forEachControls(control => control.markAsBlurred())
    } else {
      this._blurred.value = true
    }

    if (this.trigger === 'blur') {
      this._validate()
    }
  }

  /**
   * Marks the control as `unblurred`.
   */
  markAsUnblurred(): void {
    if (this._controls.value) {
      this._forEachControls(control => control.markAsUnblurred())
    } else {
      this._blurred.value = false
    }
  }

  /**
   * Marks the control as `dirty`.
   */
  markAsDirty(): void {
    if (this._controls.value) {
      this._forEachControls(control => control.markAsDirty())
    } else {
      this._dirty.value = true
    }
  }

  /**
   * Marks the control as `pristine`.
   */
  markAsPristine(): void {
    if (this._controls.value) {
      this._forEachControls(control => control.markAsPristine())
    } else {
      this._dirty.value = false
    }
  }

  /**
   * Sets the new sync validator for the form control, it overwrites existing sync validators.
   *
   * If you want to clear all sync validators, you can pass in a undefined.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   */
  setValidators(newValidators?: ValidatorFn | ValidatorFn[]): void {
    this._validators = newValidators
    this._composedValidators = toValidator(newValidators)
  }

  /**
   * Sets the new async validator for the form control, it overwrites existing async validators.
   *
   * If you want to clear all async validators, you can pass in a undefined.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   */
  setAsyncValidators(newAsyncValidators?: AsyncValidatorFn | AsyncValidatorFn[]): void {
    this._asyncValidators = newAsyncValidators
    this._composedAsyncValidators = toAsyncValidator(newAsyncValidators)
  }

  /**
   * Add a synchronous validator or validators to this control, without affecting other validators.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   */
  addValidators(validators: ValidatorFn | ValidatorFn[]): void {
    this.setValidators(addValidators(validators, this._validators))
  }

  /**
   * Add an asynchronous validator or validators to this control, without affecting other
   * validators.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   */
  addAsyncValidators(validators: AsyncValidatorFn | AsyncValidatorFn[]): void {
    this.setAsyncValidators(addValidators(validators, this._asyncValidators))
  }

  /**
   * Remove a synchronous validator from this control, without affecting other validators.
   * Validators are compared by function reference; you must pass a reference to the exact same
   * validator function as the one that was originally set. If a provided validator is not found,
   * it is ignored.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   */
  removeValidators(validators: ValidatorFn | ValidatorFn[]): void {
    this.setValidators(removeValidators(validators, this._validators))
  }

  /**
   * Remove an asynchronous validator from this control, without affecting other validators.
   * Validators are compared by function reference; you must pass a reference to the exact same
   * validator function as the one that was originally set. If a provided validator is not found, it
   * is ignored.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   */
  removeAsyncValidators(validators: AsyncValidatorFn | AsyncValidatorFn[]): void {
    this.setAsyncValidators(removeValidators(validators, this._asyncValidators))
  }

  /**
   * Empties out the synchronous validators.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   *
   */
  clearValidators(): void {
    this.setValidators(undefined)
  }

  /**
   * Empties out the async validators.
   *
   * When you add or remove a validator at run time, you must call `validate()` for the new validation to take effect.
   *
   */
  clearAsyncValidators(): void {
    this.setAsyncValidators(undefined)
  }

  /**
   * Check whether a synchronous validator function is present on this control. The provided
   * validator must be a reference to the exact same function that was provided.
   *
   */
  hasValidator(validator: ValidatorFn): boolean {
    return hasValidator(this._validators, validator)
  }

  /**
   * Check whether an asynchronous validator function is present on this control. The provided
   * validator must be a reference to the exact same function that was provided.
   *
   */
  hasAsyncValidator(validator: AsyncValidatorFn): boolean {
    return hasValidator(this._asyncValidators, validator)
  }

  /**
   * Retrieves a child control given the control's key or path.
   *
   * @param path A dot-delimited string or array of string/number values that define the path to the
   * control.
   */
  get<K extends OptionalKeys<T>>(path: K): AbstractControl<T[K]> | undefined
  get<K extends keyof T>(path: K): AbstractControl<T[K]>
  get<TK = any>(path: ControlPathType): AbstractControl<TK> | undefined
  get<TK = any>(path: ControlPathType): AbstractControl<TK> | undefined {
    if (isNil(path)) {
      return undefined
    }

    const currPath = isString(path) ? path.split('.') : convertArray(path)

    if (currPath.length === 0) {
      return undefined
    }

    return currPath.reduce((control: AbstractControl<any> | undefined, name) => control && control._find(name), this)
  }

  /**
   * Sets errors on a form control when running validations manually, rather than automatically.
   *
   * If you want to clear errors, you can pass in a undefined.
   *
   */
  setErrors(errors?: ValidateErrors, path?: ControlPathType): void {
    if (!isNil(path)) {
      this.get(path)?.setErrors(errors)
    } else {
      this._errors.value = errors
    }
  }

  /**
   * Empties out the errors.
   *
   */
  clearErrors(path?: ControlPathType): void {
    this.setErrors(undefined, path)
  }

  /**
   * Reports error data for the control with the given path.
   *
   * @param errorCode The code of the error to check
   * @param path A list of control names that designates how to move from the current control
   * to the control that should be queried for errors.
   */
  getError(errorCode: string, path?: ControlPathType): ValidateError | undefined {
    const control = path ? this.get(path) : (this as AbstractControl)
    return control?._errors?.value?.[errorCode]
  }

  /**
   * Reports whether the control with the given path has the error specified.
   *
   * @param errorCode The code of the error to check
   * @param path A list of control names that designates how to move from the current control
   * to the control that should be queried for errors.
   */
  hasError(errorCode: string, path?: ControlPathType): boolean {
    return !!this.getError(errorCode, path)
  }

  /**
   * Sets the parent of the control
   */
  setParent(parent: AbstractControl): void {
    this._parent = parent
  }

  /**
   * Watch the ref value for the control.
   *
   * @param cb The callback when the value changes
   * @param options Optional options of watch
   */
  watchValue(cb: WatchCallback<T, T | undefined>, options?: WatchOptions): WatchStopHandle {
    return watch(this.valueRef, cb, options)
  }

  /**
   * Watch the status for the control.
   *
   * @param cb The callback when the status changes
   * @param options Optional options of watch
   */
  watchStatus(cb: WatchCallback<ValidateStatus, ValidateStatus | undefined>, options?: WatchOptions): WatchStopHandle {
    return watch(this.status, cb, options)
  }

  protected async _validate(): Promise<ValidateErrors | undefined> {
    let newErrors = undefined
    if (!this._disabled.value) {
      let value = undefined
      if (this._composedValidators) {
        value = this.getValue()
        newErrors = this._composedValidators(value, this)
      }
      if (isNil(newErrors) && this._composedAsyncValidators) {
        if (!this._composedValidators) {
          value = this.getValue()
        }
        this._status.value = 'validating'
        newErrors = await this._composedAsyncValidators(value, this)
      }
    }
    this.setErrors(newErrors)
    this._status.value = newErrors ? 'invalid' : 'valid'
    return newErrors
  }

  private _convertOptions(
    validatorOrOptions?: ValidatorFn | ValidatorFn[] | ValidatorOptions,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[],
  ) {
    let _disabled = false
    if (isOptions(validatorOrOptions)) {
      const { name, example, trigger, validators, asyncValidators, disabled } = validatorOrOptions
      this.name = name
      this.example = example
      this.setValidators(validators)
      this.setAsyncValidators(asyncValidators)

      if (trigger) {
        this._trigger = trigger
      }

      if (disabled) {
        if (isFunction(disabled)) {
          _disabled = disabled(this, true)
          this._disabledFn = disabled
        } else {
          _disabled = true
        }
        _disabled && this._forEachControls(control => control.disable())
      }
    } else {
      this.setValidators(validatorOrOptions)
      this.setAsyncValidators(asyncValidator)
    }
    this._disabled = ref(_disabled)
  }

  private _init(): void {
    const current = this as any
    current.controls = computed(() => this._controls.value)
    current.valueRef = computed(() => this._valueRef.value)
    this._initErrorsAndStatus()
    current.errors = computed(() => this._errors.value)
    current.status = computed(() => {
      const selfStatus = this._status.value
      if (selfStatus === 'valid') {
        return this._controlsStatus.value
      }
      return selfStatus
    })
    current.valid = computed(() => this.status.value === 'valid')
    current.invalid = computed(() => this.status.value === 'invalid')
    current.validating = computed(() => this.status.value === 'validating')
    current.disabled = computed(() => this._disabled.value)
    current.blurred = computed(() => this._blurred.value)
    current.unblurred = computed(() => !this._blurred.value)
    current.dirty = computed(() => this._dirty.value)
    current.pristine = computed(() => !this._dirty.value)

    if (this._disabledFn) {
      nextTick(() => {
        watchEffect(() => {
          if (this._disabledFn!(this, false)) {
            this.disable()
          } else {
            this.enable()
          }
        })
      })
    }
  }

  private _initErrorsAndStatus() {
    const disabled = this._disabled.value
    let value: T | undefined
    let errors: ValidateErrors | undefined
    let status: ValidateStatus = 'valid'
    let controlsStatus: ValidateStatus = 'valid'

    if (!disabled) {
      if (this._composedValidators) {
        value = this.getValue()
        errors = this._composedValidators(value, this)
      }

      if (errors) {
        status = 'invalid'
      }

      this._forEachControls(control => {
        if (control.status.value === 'invalid') {
          controlsStatus = 'invalid'
        }
      })
    }

    this._errors = shallowRef(errors)
    this._status = ref(status)
    this._controlsStatus = ref(controlsStatus)

    if (!disabled && status === 'valid' && controlsStatus === 'valid' && this._composedAsyncValidators) {
      value = this._validators ? value : this.getValue()
      this._status.value = 'validating'
      this._composedAsyncValidators(value, this).then(asyncErrors => {
        this._errors.value = asyncErrors
        this._status.value = asyncErrors ? 'invalid' : 'valid'
      })
    }
  }
}
