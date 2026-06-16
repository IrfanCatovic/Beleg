import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

export function useNavDropdowns(isMenuOpen: boolean) {
  const location = useLocation()

  const [navExploreOpen, setNavExploreOpen] = useState(false)
  const [navClubOpen, setNavClubOpen] = useState(false)
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false)
  const [mobileClubOpen, setMobileClubOpen] = useState(false)
  const navExploreRef = useRef<HTMLDivElement>(null)
  const navClubRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const insideNavExplore = navExploreRef.current?.contains(target)
      const insideNavClub = navClubRef.current?.contains(target)
      if (navExploreOpen && !insideNavExplore) setNavExploreOpen(false)
      if (navClubOpen && !insideNavClub) setNavClubOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [navExploreOpen, navClubOpen])

  useEffect(() => {
    setNavExploreOpen(false)
    setNavClubOpen(false)
    setMobileExploreOpen(false)
    setMobileClubOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMenuOpen) {
      setMobileExploreOpen(false)
      setMobileClubOpen(false)
    }
  }, [isMenuOpen])

  const closeNavDropdowns = () => {
    setNavExploreOpen(false)
    setNavClubOpen(false)
  }

  return {
    navExploreOpen,
    setNavExploreOpen,
    navClubOpen,
    setNavClubOpen,
    mobileExploreOpen,
    setMobileExploreOpen,
    mobileClubOpen,
    setMobileClubOpen,
    navExploreRef,
    navClubRef,
    closeNavDropdowns,
  }
}

export type NavDropdownsState = ReturnType<typeof useNavDropdowns>
