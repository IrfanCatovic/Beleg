import ProfileSettingsButton from './ProfileSettingsButton'
import ProfileInfoButton from './ProfileInfoButton'
import ProfilePrintButton from './ProfilePrintButton'

interface ProfileActionButtonsProps {
  userId: string | number
  isOwnProfile: boolean
  currentUser: { role: string; username: string } | null
  onPrintClick?: () => void
  children?: React.ReactNode
}

export default function ProfileActionButtons({
  userId,
  isOwnProfile,
  currentUser,
  onPrintClick,
  children,
}: ProfileActionButtonsProps) {
  // Na tuđim profilima samo admin i sekretar vide ova 3 dugmeta (info, gear, štampaj); ostali ih ne vide
  const canSeeProfileActions = !currentUser || isOwnProfile || currentUser.role === 'admin' || currentUser.role === 'sekretar'

  const showSettings =
    currentUser &&
    canSeeProfileActions &&
    (currentUser.role === 'admin' || currentUser.role === 'sekretar' || isOwnProfile)
  const settingsLink = isOwnProfile ? '/profil/podesavanja' : `/profil/podesavanja/${userId}`

  const showInfo = currentUser && canSeeProfileActions && (currentUser.role === 'admin' || currentUser.role === 'sekretar' || isOwnProfile)
  const infoLink = `/users/${userId}/info`

  const showPrint = canSeeProfileActions && onPrintClick

  return (
    <div className="absolute top-2 right-4 md:top-6 md:right-12 z-10 flex items-center gap-2 flex-wrap">
      {showSettings && <ProfileSettingsButton to={settingsLink} />}
      {showInfo && <ProfileInfoButton to={infoLink} />}
      {showPrint && <ProfilePrintButton onClick={onPrintClick} />}
      {children}
    </div>
  )
}
