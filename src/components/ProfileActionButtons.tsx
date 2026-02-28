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
  const showSettings =
    currentUser &&
    (currentUser.role === 'admin' || currentUser.role === 'sekretar' || isOwnProfile)
  const settingsLink = isOwnProfile ? '/profil/podesavanja' : `/profil/podesavanja/${userId}`

  const showInfo = currentUser && (currentUser.role === 'admin' || currentUser.role === 'sekretar')
  const infoLink = `/users/${userId}/info`

  return (
    <div className="absolute top-6 right-12 z-10 flex items-center gap-2">
      {showSettings && <ProfileSettingsButton to={settingsLink} />}
      {showInfo && <ProfileInfoButton to={infoLink} />}
      <ProfilePrintButton onClick={onPrintClick} />
      {children}
    </div>
  )
}
