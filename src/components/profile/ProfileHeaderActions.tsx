import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline'
import ProfileActionButtons from '../buttons/ProfileActionButtons'
import type { MemberPdfData } from '../../utils/generateMemberPdf'
import { generateMemberPdf } from '../../utils/generateMemberPdf'

export const PROFILE_OVERFLOW_ACTION_ORDER = ['settings', 'info', 'print'] as const

const COVER_ACTION_CLASS =
  '!w-11 !h-11 !min-w-[2.75rem] !min-h-[2.75rem] !p-0 !justify-center !rounded-full !bg-emerald-600 !text-white hover:!bg-emerald-700 hover:!text-white ring-2 ring-white/40 shadow-xl'

type CurrentUser = { role: string; username: string } | null

/** Tri tačkice na coveru — dropdown sa kružnim akcijama (settings/info/print). */
export function ProfileHeaderActions({
  isOwn,
  userId,
  currentUser,
  korisnikForPdf,
  clubName,
  visible,
}: {
  isOwn: boolean
  userId: string | number
  currentUser: CurrentUser
  korisnikForPdf: MemberPdfData
  clubName: string
  visible: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 68, right: 16 })

  const updateMenuPos = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) })
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPos()
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', updateMenuPos)
    window.addEventListener('scroll', updateMenuPos, true)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', updateMenuPos)
      window.removeEventListener('scroll', updateMenuPos, true)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, updateMenuPos])

  const print = () =>
    generateMemberPdf({
      ...korisnikForPdf,
      clubName: clubName || '',
    })

  if (!visible) return null

  return (
    <>
      <div
        className="absolute top-4 right-3 sm:top-3 sm:right-6 md:top-6 md:right-12 z-[260] pointer-events-auto"
        data-testid="profile-header-actions"
      >
        <button
          ref={buttonRef}
          type="button"
          aria-label={open ? 'Zatvori meni akcija' : 'Otvori meni akcija'}
          aria-expanded={open}
          aria-controls={menuId}
          data-testid="profile-actions-overflow"
          onClick={() => {
            if (!open) updateMenuPos()
            setOpen((v) => !v)
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-transform duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <span className={`inline-flex transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
            {open ? <XMarkIcon className="h-6 w-6" aria-hidden /> : <EllipsisHorizontalIcon className="h-6 w-6" aria-hidden />}
          </span>
        </button>
      </div>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[290]" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-black/15"
                aria-label="Zatvori meni akcija"
                onClick={() => setOpen(false)}
              />
              <div
                id={menuId}
                role="menu"
                className="fixed mobile-actions-dropdown flex flex-col items-end gap-2 z-[300]"
                style={{ top: menuPos.top, right: menuPos.right }}
                onClick={() => window.setTimeout(() => setOpen(false), 0)}
              >
                <ProfileActionButtons
                  inline
                  direction="column"
                  userId={userId}
                  isOwnProfile={isOwn}
                  currentUser={currentUser}
                  onPrintClick={print}
                  actionOrder={[...PROFILE_OVERFLOW_ACTION_ORDER]}
                  actionClassName={COVER_ACTION_CLASS}
                  className="!gap-2.5"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
