import ProfileSettingsButton from './ProfileSettingsButton'
import ProfileInfoButton from './ProfileInfoButton'
import ProfilePrintButton from './ProfilePrintButton'

interface ProfileActionButtonsProps {
  userId: string | number
  isOwnProfile: boolean
  currentUser: { role: string; username: string } | null
  onPrintClick?: () => void
  children?: React.ReactNode
  /** Bez absolute pozicioniranja — koristi unutar sopstvenog toolbar kontejnera (npr. cover) */
  inline?: boolean
  className?: string
  actionClassName?: string
  actionOrder?: Array<'settings' | 'info' | 'print'>
  direction?: 'row' | 'column'
}

export default function ProfileActionButtons({
  userId,
  isOwnProfile,
  currentUser,
  onPrintClick,
  children,
  inline = false,
  className = '',
  actionClassName = '',
  actionOrder = ['settings', 'info', 'print'],
  direction = 'row',
}: ProfileActionButtonsProps) {
  // Na tuđim profilima samo admin i sekretar vide ova 3 dugmeta (info, gear, štampaj); ostali ih ne vide
  const canSeeProfileActions = !currentUser || isOwnProfile || currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'sekretar'

  const showSettings =
    currentUser &&
    canSeeProfileActions &&
    (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'sekretar' || isOwnProfile)
  const settingsLink = isOwnProfile ? '/profil/podesavanja' : `/profil/podesavanja/${userId}`

  const showInfo = currentUser && canSeeProfileActions && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'sekretar' || isOwnProfile)
  const infoLink = `/users/${userId}/info`

  const showPrint = currentUser && canSeeProfileActions && onPrintClick

  const directionClass = direction === 'column' ? 'flex-col' : 'flex-row'
  const wrapClass = direction === 'column' ? '' : 'flex-wrap'
  const layoutClass = inline
    ? `relative z-auto flex ${directionClass} items-center gap-2 ${wrapClass} pointer-events-auto`
    : `absolute top-4 right-3 sm:top-3 sm:right-6 md:top-6 md:right-12 z-30 flex ${directionClass} items-center gap-2 ${wrapClass} pointer-events-auto`

  const renderedActions: React.ReactNode[] = []
  actionOrder.forEach((action) => {
    if (action === 'settings' && showSettings) {
      renderedActions.push(<ProfileSettingsButton key="settings" to={settingsLink} className={actionClassName} />)
    }
    if (action === 'info' && showInfo) {
      renderedActions.push(<ProfileInfoButton key="info" to={infoLink} className={actionClassName} />)
    }
    if (action === 'print' && showPrint) {
      renderedActions.push(<ProfilePrintButton key="print" onClick={onPrintClick} className={actionClassName} />)
    }
  })

  return (
    <div className={`${layoutClass} ${className}`.trim()}>
      {renderedActions}
      {children}
    </div>
  )
}
