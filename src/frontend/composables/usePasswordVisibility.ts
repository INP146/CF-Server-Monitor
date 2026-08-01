import { reactive } from 'vue'

export function usePasswordVisibility(initialFields: readonly string[] = []) {
  const visibility = reactive<Record<string, boolean>>(
    Object.fromEntries(initialFields.map((field) => [field, false])),
  )
  const hasField = (field: string) => Object.hasOwn(visibility, field)

  const toggle = (field: string) => { if (hasField(field)) visibility[field] = !visibility[field] }
  const show = (field: string) => { if (hasField(field)) visibility[field] = true }
  const hide = (field: string) => { if (hasField(field)) visibility[field] = false }
  const reset = () => { for (const field of Object.keys(visibility)) visibility[field] = false }
  const addField = (field: string) => { if (!hasField(field)) visibility[field] = false }
  const getInputType = (field: string): 'text' | 'password' => visibility[field] ? 'text' : 'password'

  return { visibility, toggle, show, hide, reset, addField, getInputType }
}
