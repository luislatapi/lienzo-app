import { create } from 'zustand'

export type LeftTab = 'add' | 'layers' | 'pages' | 'media' | 'site' | 'files'
export type RightTab = 'style' | 'content' | 'advanced'

export interface Toast {
  id: number
  kind: 'ok' | 'error' | 'info'
  text: string
}

export type DialogName =
  | null
  | 'publish'
  | 'code'
  | 'conflict'
  | 'shortcuts'
  | 'new-page'
  | 'image-picker'
  | 'leave'
  | 'branch'

interface UIState {
  leftTab: LeftTab | null
  rightTab: RightTab
  zoom: 'fit' | number
  preview: boolean
  /** página que se ve ahora en la vista previa (puede cambiar al seguir enlaces) */
  previewPath: string | null
  dialog: DialogName
  dialogData: unknown
  toasts: Toast[]
  setLeftTab(t: LeftTab | null): void
  setRightTab(t: RightTab): void
  setZoom(z: 'fit' | number): void
  setPreview(p: boolean): void
  setPreviewPath(p: string | null): void
  openDialog(d: Exclude<DialogName, null>, data?: unknown): void
  closeDialog(): void
  toast(kind: Toast['kind'], text: string): void
  dismissToast(id: number): void
}

let toastSeq = 0

export const useUI = create<UIState>((set, get) => ({
  leftTab: 'add',
  rightTab: 'style',
  zoom: 'fit',
  preview: false,
  previewPath: null,
  dialog: null,
  dialogData: null,
  toasts: [],
  setLeftTab: (t) => set({ leftTab: t }),
  setRightTab: (t) => set({ rightTab: t }),
  setZoom: (z) => set({ zoom: z }),
  setPreview: (p) => set({ preview: p, previewPath: p ? get().previewPath : null }),
  setPreviewPath: (p) => set({ previewPath: p }),
  openDialog: (d, data) => set({ dialog: d, dialogData: data ?? null }),
  closeDialog: () => set({ dialog: null, dialogData: null }),
  toast(kind, text) {
    const id = ++toastSeq
    set({ toasts: [...get().toasts, { id, kind, text }] })
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3600)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
