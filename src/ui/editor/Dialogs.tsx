import { useUI } from '../../store/ui'
import { CodeDialog } from './dialogs/CodeDialog'
import { ImagePickerDialog } from './dialogs/ImagePickerDialog'
import { NewPageDialog } from './dialogs/NewPageDialog'
import { PublishDialog } from './dialogs/PublishDialog'
import { BranchDialog, ConflictDialog, LeaveDialog, ShortcutsDialog } from './dialogs/SmallDialogs'

/** Muestra el diálogo abierto (solo uno a la vez). */
export function Dialogs() {
  const dialog = useUI((s) => s.dialog)
  switch (dialog) {
    case 'publish':
      return <PublishDialog />
    case 'code':
      return <CodeDialog />
    case 'conflict':
      return <ConflictDialog />
    case 'shortcuts':
      return <ShortcutsDialog />
    case 'new-page':
      return <NewPageDialog />
    case 'image-picker':
      return <ImagePickerDialog />
    case 'leave':
      return <LeaveDialog />
    case 'branch':
      return <BranchDialog />
    default:
      return null
  }
}
