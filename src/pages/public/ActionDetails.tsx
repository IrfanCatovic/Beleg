import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  deleteAkcija,
  deletePrijava,
  dodajClanaPopeoSe,
  dodajPrevoz,
  fetchMojaPrijavaZaAkciju,
  fetchPrijaveZaAkciju,
  obrisiPrevoz,
  updatePrijavaStatus,
  zavrsiAkciju,
} from '../../services/actions'
import { getApiErrorMessage } from '../../utils/apiError'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { generateActionPdfPrePolaska, generateActionPdfZavrsena } from '../../utils/generateActionPdf'
import { formatDate } from '../../utils/dateUtils'
import { canManageHostAkcija } from '../../utils/canManageAkcija'
import Dropdown from '../../components/Dropdown'
import { actionDifficultyBadge, ferrataTezinaLabel, prijavaStatusLabel } from '../../utils/difficultyI18n'
import {
  ferrataActionLocationSubtitle,
  ferrataActionName,
  ferrataActionRegion,
  ferrataActionDurationLabel,
} from '../../utils/actionFerrataDisplay'
import TransportCard from '../../components/action-details/TransportCard'
import AddTransportModal from '../../components/action-details/AddTransportModal'
import AccommodationCard from '../../components/action-details/AccommodationCard'
import EquipmentItem from '../../components/action-details/EquipmentItem'
import MemberDetailsModal from '../../components/action-details/MemberDetailsModal'
import { UserNameWithProfiBadge } from '../../components/users/UserNameWithProfiBadge'
import FinishActionFinanceModal from '../../components/action-details/FinishActionFinanceModal'
import { GuideRatingModal } from '../../components/action-details/GuideRatingModal'
import type { Prijava } from '../../types/prijava'
import { PRIJAVA_STATUS_STYLE, singlePrevozIdSet } from '../../components/action-details/actionDetailsUtils'
import { StatCell, InfoRow } from '../../components/action-details/actionDetailsUi'
import { ActionDetailsHeader } from '../../components/action-details/ActionDetailsHeader'
import { useActionDetailsData } from '../../hooks/action-details/useActionDetailsData'
import { useActionRegistration } from '../../hooks/action-details/useActionRegistration'
import { useExternalUserSearch } from '../../hooks/action-details/useExternalUserSearch'
import { useParticipationRequests } from '../../hooks/action-details/useParticipationRequests'
import { useActionPayments } from '../../hooks/action-details/useActionPayments'
import { useActionShare } from '../../hooks/action-details/useActionShare'
import { useGuideRatings } from '../../hooks/action-details/useGuideRatings'

export default function ActionDetails() {
  const { t, i18n } = useTranslation('actionDetails')
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const navigate = useNavigate()
  const inviteToken = (searchParams.get('inviteToken') ?? '').trim()
  const claimRewardRequested = (searchParams.get('claimReward') ?? '').trim() === '1'

  const {
    akcija,
    setAkcija,
    prijave,
    setPrijave,
    canSeePrijave,
    loading,
    error,
    clubMembers,
    clubCurrency,
    prevozPrijave,
    reloadAkcija,
    refreshPrijave,
  } = useActionDetailsData({ id, inviteToken, user, loadErrorFallback: t('loadError') })

  const {
    mojaPrijava,
    setMojaPrijava,
    selSmestaj,
    selPrevoz,
    setSelPrevoz,
    selRent,
    selectionsDirty,
    savingSelections,
    registerOptionsOpen,
    setRegisterOptionsOpen,
    toggleSmestaj,
    togglePrevoz,
    setRentQty,
    handleSavePrijavaOrUpdate,
    handleCancelPrijava,
  } = useActionRegistration({
    id,
    user,
    akcija,
    inviteToken,
    reloadAkcija,
    refreshPrijave,
    showAlert,
    showConfirm,
    t,
  })

  const canManageHostForExternal = !!(
    user &&
    akcija &&
    canManageHostAkcija(user, {
      klubId: akcija.klubId,
      organizatorTip: akcija.organizatorTip,
      vodicId: akcija.vodicId,
      vodicUsername: akcija.vodic?.username,
    }) &&
    akcija.isCompleted
  )

  const externalUserSearch = useExternalUserSearch({
    actionId: id,
    enabled: canManageHostForExternal,
    autoFetch: true,
    withScope: true,
  })

  const {
    scope: externalScope,
    setScope: setExternalScope,
    search: externalSearch,
    setSearch: setExternalSearch,
    candidates: externalCandidates,
    loading: externalLoading,
    error: externalError,
    handleScroll: handleExternalCandidatesScroll,
    removeCandidate: removeExternalCandidate,
    markHasMore: markExternalHasMore,
  } = externalUserSearch

  const {
    actionParticipationRequests,
    requestsLoading,
    sendingExternalRequestId,
    handleSendExternalRequest: sendExternalRequest,
    handleCancelExternalRequest,
  } = useParticipationRequests({
    id,
    user,
    akcija,
    showAlert,
    showConfirm,
    t,
    removeExternalCandidate,
    markExternalHasMore,
  })

  const handleSendExternalRequest = (candidate: (typeof externalCandidates)[number]) =>
    sendExternalRequest(candidate, externalUserSearch.setError)

  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [addingMemberError, setAddingMemberError] = useState('')
  const [addTransportOpen, setAddTransportOpen] = useState(false)
  const [memberModal, setMemberModal] = useState<Prijava | null>(null)
  const [finishFinanceModalOpen, setFinishFinanceModalOpen] = useState(false)

  useEffect(() => {
    if (!user || !akcija || !canManageHostAkcija(user, {
      klubId: akcija.klubId,
      organizatorTip: akcija.organizatorTip,
      vodicId: akcija.vodicId,
      vodicUsername: akcija.vodic?.username,
    }) || !akcija.isCompleted) {
      setSelectedMemberId('')
    }
  }, [user, akcija])

  const canManageHost = !!(
    user &&
    akcija &&
    canManageHostAkcija(user, {
      klubId: akcija.klubId,
      organizatorTip: akcija.organizatorTip,
      vodicId: akcija.vodicId,
      vodicUsername: akcija.vodic?.username,
    })
  )

  const {
    bulkPaymentMode,
    setBulkPaymentMode,
    bulkPaymentSubmitting,
    bulkSelectedPaymentIds,
    setBulkSelectedPaymentIds,
    paymentTrackedPrijave,
    handleTogglePaymentStatus,
    toggleBulkSelectionForUser,
    handleToggleSelectAllBulkPayments,
    handleBulkMarkAsPaid,
  } = useActionPayments({
    canManageHost,
    prijave,
    setPrijave,
    setMemberModal,
    showAlert,
    showConfirm,
    t,
  })

  const {
    summitShareOpen,
    summitShareStep,
    setSummitShareStep,
    summitPickedAspect,
    setSummitPickedAspect,
    summitPreviewBalanced,
    summitPreviewStacked,
    ferrataBadgePreview,
    summitPreviewLoading,
    actionShareUrl,
    actionShareLoading,
    actionShareCopied,
    actionShareError,
    isFerrataReward,
    canClaimSummitReward,
    resolveActionPublicUrl,
    closeSummitShareModal,
    openSummitShareModal,
    copyActionShareLink,
    handleFerrataBadgeDownload,
    handleSummitPngDownload,
  } = useActionShare({
    id,
    akcija,
    user,
    inviteToken,
    claimRewardRequested,
    mojaPrijava,
    canManageHost,
    showAlert,
    t,
    i18nLanguage: i18n.language,
  })

  const {
    guideRatingOpen,
    setGuideRatingOpen,
    guideRatingSubmitted,
    guideRatingSkipped,
    guideRatingSaving,
    guideRatingGuideName,
    canShowGuideRatingPrompt,
    handleGuideRatingSubmit,
    handleGuideRatingSkip,
  } = useGuideRatings({
    id,
    user,
    akcija,
    mojaPrijava,
    showAlert,
    t,
  })

  const locationSubtitle = useMemo(() => {
    if (!akcija) return ''
    if (akcija.tipAkcije === 'via_ferrata') {
      return ferrataActionLocationSubtitle(akcija)
    }
    return [akcija.planina, akcija.vrh].filter(Boolean).join(' · ')
  }, [akcija])

  const handleAddTransport = async (data: { tipPrevoza: string; nazivGrupe: string; kapacitet: number; cenaPoOsobi: number; join: boolean }) => {
    if (!id) return
    await dodajPrevoz(id!, data)
    setAddTransportOpen(false)
    await reloadAkcija()
    if (data.join) {
      const mp = await fetchMojaPrijavaZaAkciju(id!)
      const p = mp.prijava ?? null
      setMojaPrijava(p)
      if (p) {
        setSelPrevoz(singlePrevozIdSet(p.selectedPrevozIds))
      }
    }
  }

  const handleDeletePrevoz = async (row: { id: number; nazivGrupe: string }) => {
    if (!id || !user || !akcija || !canManageHostAkcija(user, {
        klubId: akcija.klubId,
        organizatorTip: akcija.organizatorTip,
        vodicId: akcija.vodicId,
        vodicUsername: akcija.vodic?.username,
      })) return
    const ok = await showConfirm(
      `Da li ste sigurni da želite da obrišete prevoz „${row.nazivGrupe}"? Svi koji su bili prijavljeni na ovaj prevoz biće uklonjeni sa prevoza (neće biti automatski prebačeni na drugi prevoz).`,
      { variant: 'danger', confirmLabel: 'Obriši', cancelLabel: 'Otkaži' }
    )
    if (!ok) return
    try {
      await obrisiPrevoz(id!, row.id)
      setSelPrevoz((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
      await reloadAkcija()
      await refreshPrijave()
      if (user) {
        try {
          const mp = await fetchMojaPrijavaZaAkciju(id!)
          const p = mp.prijava ?? null
          setMojaPrijava(p)
          if (p) {
            setSelPrevoz(singlePrevozIdSet(p.selectedPrevozIds))
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      await showAlert(getApiErrorMessage(err, 'Greška pri brisanju prevoza'), t('errorTitle'))
    }
  }

  const handleDelete = async () => {
    const confirmed = await showConfirm(t('deleteConfirmMessage'), { variant: 'danger', confirmLabel: t('delete') })
    if (!confirmed) return
    try {
      await deleteAkcija(id!)
      await showAlert(t('deleteSuccess'))
      navigate('/akcije')
    } catch (err: any) {
      await showAlert(getApiErrorMessage(err, t('deleteError')), t('errorTitle'))
    }
  }

  const handleEdit = () => navigate(`/akcije/${id}/izmeni`)

  const handleUpdateStatus = async (prijavaId: number, newStatus: string) => {
    if (!canManageHost) return
    try {
      await updatePrijavaStatus(prijavaId, newStatus)
      const list: Prijava[] = await fetchPrijaveZaAkciju(id!)
      // nije neophodno ponovo povlačiti avatare, ali možemo zadržati postojeće
      setPrijave((prev) => {
        const avatarMap = new Map<number, string | undefined>()
        prev.forEach((p) => avatarMap.set(p.id, p.avatarUrl))
        return list.map((p) => ({
          ...p,
          avatarUrl: p.avatarUrl || (p as any).avatar_url || avatarMap.get(p.id),
        }))
      })
    } catch {
      await showAlert(t('updateStatusError'), t('errorTitle'))
    }
  }

  const handleRemoveFromAction = async (prijavaId: number, displayName: string) => {
    if (!canManageHost) return
    const confirmed = await showConfirm(t('removeMemberConfirm', { name: displayName }), {
      title: t('removeMemberTitle'),
      confirmLabel: 'Prihvati',
      cancelLabel: 'Otkaži',
    })
    if (!confirmed) return
    try {
      await deletePrijava(prijavaId)
      const list: Prijava[] = await fetchPrijaveZaAkciju(id!)
      setPrijave((prev) => {
        const avatarMap = new Map<number, string | undefined>()
        prev.forEach((p) => avatarMap.set(p.id, p.avatarUrl))
        return list.map((p) => ({
          ...p,
          avatarUrl: p.avatarUrl || (p as any).avatar_url || avatarMap.get(p.id),
        }))
      })
    } catch (err: any) {
      await showAlert(getApiErrorMessage(err, t('removeMemberError')), t('errorTitle'))
    }
  }

  const handleAddCompletedMember = async () => {
    if (!id || !selectedMemberId) return
    setAddingMemberError('')
    setAddingMember(true)
    try {
      await dodajClanaPopeoSe(id!, Number(selectedMemberId))
      const list: Prijava[] = await fetchPrijaveZaAkciju(id!)
      setPrijave((prev) => {
        const avatarMap = new Map<number, string | undefined>()
        prev.forEach((p) => avatarMap.set(p.id, p.avatarUrl))
        return list.map((p) => ({
          ...p,
          avatarUrl: p.avatarUrl || (p as any).avatar_url || avatarMap.get(p.id),
        }))
      })
      setSelectedMemberId('')
      await showAlert('Clan je dodat i oznacen kao uspesno popeo se.')
    } catch (err: any) {
      setAddingMemberError(getApiErrorMessage(err, 'Neuspesno dodavanje clana na zavrsenu akciju.'))
    } finally {
      setAddingMember(false)
    }
  }

  const equipmentList = useMemo(() => {
    type Row = {
      key: string
      naziv: string
      obavezna: boolean
      rent?: { rentId: number; dostupnaKolicina: number; cenaPoSetu: number }
    }
    const rows: Row[] = []
    const seenAkcOpremaIds = new Set<number>()

    for (const it of akcija?.oprema || []) {
      rows.push({
        key: `op-${it.id}`,
        naziv: it.naziv,
        obavezna: !!it.obavezna,
      })
      seenAkcOpremaIds.add(it.id)
    }

    for (const r of akcija?.opremaRent || []) {
      const nameKey = r.nazivOpreme.trim().toLowerCase()
      const existingByAkcId = r.akcijaOpremaId && seenAkcOpremaIds.has(r.akcijaOpremaId)
        ? rows.find((x) => x.key === `op-${r.akcijaOpremaId}`)
        : undefined
      const existing = existingByAkcId || rows.find((x) => x.naziv.trim().toLowerCase() === nameKey)

      if (existing) {
        existing.rent = { rentId: r.id, dostupnaKolicina: r.dostupnaKolicina, cenaPoSetu: r.cenaPoSetu }
      } else {
        rows.push({
          key: `rent-${r.id}`,
          naziv: r.nazivOpreme,
          obavezna: false,
          rent: { rentId: r.id, dostupnaKolicina: r.dostupnaKolicina, cenaPoSetu: r.cenaPoSetu },
        })
      }
    }
    return rows
  }, [akcija?.oprema, akcija?.opremaRent])

  const summaryRows = useMemo(() => {
    const out: Array<{ label: string; amount: number; tag: string; tagBg: string }> = []
    const prevozMap = new Map<number, { nazivGrupe: string; cenaPoOsobi: number; tipPrevoza: string }>()
    for (const p of akcija?.prevoz || []) {
      prevozMap.set(p.id, { nazivGrupe: p.nazivGrupe, cenaPoOsobi: p.cenaPoOsobi, tipPrevoza: p.tipPrevoza })
    }
    const smestajMap = new Map<number, { naziv: string; cenaPoOsobiUkupno: number }>()
    for (const s of akcija?.smestaj || []) {
      smestajMap.set(s.id, { naziv: s.naziv, cenaPoOsobiUkupno: s.cenaPoOsobiUkupno })
    }
    const rentMap = new Map<number, { naziv: string; cenaPoSetu: number }>()
    for (const r of akcija?.opremaRent || []) {
      rentMap.set(r.id, { naziv: r.nazivOpreme, cenaPoSetu: r.cenaPoSetu })
    }

    selSmestaj.forEach((sid) => {
      const s = smestajMap.get(sid)
      if (s) out.push({ label: s.naziv, amount: s.cenaPoOsobiUkupno, tag: 'Smeštaj', tagBg: 'bg-amber-100 text-amber-700' })
    })
    selPrevoz.forEach((pid) => {
      const p = prevozMap.get(pid)
      if (p) out.push({ label: `${p.tipPrevoza} · ${p.nazivGrupe}`, amount: p.cenaPoOsobi, tag: 'Prevoz', tagBg: 'bg-sky-100 text-sky-700' })
    })
    for (const [rid, qty] of Object.entries(selRent)) {
      const r = rentMap.get(Number(rid))
      if (r && qty > 0) {
        out.push({
          label: `${r.naziv} Ã— ${qty}`,
          amount: r.cenaPoSetu * qty,
          tag: 'Rent',
          tagBg: 'bg-violet-100 text-violet-700',
        })
      }
    }
    return out
  }, [akcija?.prevoz, akcija?.smestaj, akcija?.opremaRent, selSmestaj, selPrevoz, selRent])

  const effectiveIsClanKluba = useMemo(() => {
    // Prefer local club ID match when available (more robust across backend versions).
    if (user?.klubId != null && akcija?.klubId != null) {
      return user.klubId === akcija.klubId
    }
    if (typeof akcija?.isClanKluba === 'boolean') return akcija.isClanKluba
    return false
  }, [user?.klubId, akcija?.klubId, akcija?.isClanKluba])

  const effectiveBaseCena = useMemo(() => {
    return effectiveIsClanKluba
      ? akcija?.cenaClan ?? 0
      : akcija?.javna
        ? akcija?.cenaOstali ?? 0
        : akcija?.cenaClan ?? 0
  }, [effectiveIsClanKluba, akcija?.cenaClan, akcija?.cenaOstali, akcija?.javna])

  const totalSummary = useMemo(() => {
    return summaryRows.reduce((acc, r) => acc + r.amount, effectiveBaseCena)
  }, [summaryRows, effectiveBaseCena])

  const openFinishFinanceModal = () => {
    const neoznaceni = prijave.filter((p) => p.status === 'prijavljen')
    if (neoznaceni.length > 0) {
      void showAlert(t('finishNeedStatuses'), t('markAllMembers'))
      return
    }
    setFinishFinanceModalOpen(true)
  }

  const handleConfirmFinishFinance = async (rashodNaAkciji: number) => {
    if (!id) throw new Error('missing id')
    const res = await zavrsiAkciju(id!, rashodNaAkciji)
    setFinishFinanceModalOpen(false)
    const updated = res?.akcija
    if (updated) setAkcija(updated)
    else setAkcija((prev) => (prev ? { ...prev, isCompleted: true } : null))

    let body: string
    if (akcija?.organizatorTip === 'vodic') {
      body = t('finishGuideSuccess')
    } else {
      const tip = res?.finansijeTip ?? 'nista'
      const neto = typeof res?.netoFinansije === 'number' ? res.netoFinansije : 0
      const absNet = Math.abs(neto).toFixed(2)
      body = t('finishFinanceSuccessNone')
      if (tip === 'uplata') {
        body = t('finishFinanceSuccessIncome', { amount: absNet, currency: clubCurrency })
      } else if (tip === 'isplata') {
        body = t('finishFinanceSuccessExpense', { amount: absNet, currency: clubCurrency })
      }
    }
    await showAlert(body, t('actionFinishedTitle'))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }
  if (error || !akcija) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">{error || t('notFound')}</p>
      </div>
    )
  }

  const vodicIme = [akcija.vodic?.fullName, akcija.drugiVodicIme].filter(Boolean).join(', ')
  const imenaPolaznika = prijave.map((p) => (p.fullName?.trim() ? p.fullName : p.korisnik)).join(', ')
  const uspesnoPopeli = prijave.filter((p) => p.status === 'popeo se')
  const imenaUspesnoPopeli = uspesnoPopeli.map((p) => (p.fullName?.trim() ? p.fullName : p.korisnik)).join(', ')
  const difficultyBadge = actionDifficultyBadge(akcija.tezina, t, akcija.tipAkcije)
  const isFerrataAction = akcija.tipAkcije === 'via_ferrata'
  const ferrataSnap = akcija.ferrataSnapshot
  const ferrataName = ferrataActionName(akcija)
  const ferrataRegion = ferrataActionRegion(akcija)
  const ferrataCatalogDuration = isFerrataAction
    ? ferrataActionDurationLabel(ferrataSnap, akcija.trajanjeSati)
    : null
  const ferrataDifficultyLabel = isFerrataAction
    ? ferrataTezinaLabel(ferrataSnap?.tezina || akcija.tezina)
    : ''
  const showPeakHeight = !isFerrataAction && akcija.visinaVrhM != null && akcija.visinaVrhM > 0
  const isLimitedView = !!akcija.limited
  /** Član domaćeg kluba sa ulogom `clan` — bez klika na kartice i bez modala detalja. */
  const isHostClubPlainMember =
    !!user &&
    user.role === 'clan' &&
    user.klubId != null &&
    akcija.klubId != null &&
    Number(user.klubId) === Number(akcija.klubId)
  /** Blagajnik, sekretar, menadžer opreme, itd. mogu da vide modal; admin/vodič i dalje `canManageHost` za tri akcije. */
  const canOpenMemberModal = !!user && canSeePrijave && !isLimitedView && !isHostClubPlainMember
  const memberCount =
    user && canSeePrijave && !isLimitedView ? prijave.length : (akcija.prijaveCount ?? 0)
  const paidCount = paymentTrackedPrijave.filter((p) => !!p.platio).length
  const paidTotal = paymentTrackedPrijave.reduce((acc, p) => acc + (p.platio ? p.saldo ?? 0 : 0), 0)
  const expectedTotal = paymentTrackedPrijave.reduce((acc, p) => acc + (p.saldo ?? 0), 0)
  const climbedByUsername = new Set(prijave.filter((p) => p.status === 'popeo se').map((p) => p.korisnik))
  const membersToAdd = clubMembers.filter((m) => !climbedByUsername.has(m.username))
  const pendingExternalRequestCount = actionParticipationRequests.filter((req) => req.status === 'pending').length

  const handlePrintPrePolaska = () => {
    generateActionPdfPrePolaska({
      clubName: akcija.klubNaziv || '',
      naziv: akcija.naziv, planina: akcija.planina || '', vrh: akcija.vrh,
      datum: akcija.datum, opis: akcija.opis || '', tezina: akcija.tezina || '',
      vodicIme, addedBy: akcija.addedBy?.fullName || '',
      brojPolaznika: prijave.length, imenaPolaznika,
    })
  }

  const handlePrintZavrsena = () => {
    generateActionPdfZavrsena({
      clubName: akcija.klubNaziv || '',
      naziv: akcija.naziv, planina: akcija.planina || '', vrh: akcija.vrh,
      datum: akcija.datum, opis: akcija.opis || '', tezina: akcija.tezina || '',
      vodicIme, addedBy: akcija.addedBy?.fullName || '',
      brojPrijavljenih: prijave.length, brojUspesnoPopeli: uspesnoPopeli.length,
      imenaUspesnoPopeli,
    })
  }

  const showSummitImageCard = !!user

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-16 md:pb-10">
      <ActionDetailsHeader
        akcija={akcija}
        t={t}
        locationSubtitle={locationSubtitle}
        showPeakHeight={showPeakHeight}
        isFerrataAction={isFerrataAction}
        ferrataDifficultyLabel={ferrataDifficultyLabel}
        ferrataCatalogDuration={ferrataCatalogDuration}
        memberCount={memberCount}
        effectiveIsClanKluba={effectiveIsClanKluba}
        mojaPrijava={mojaPrijava}
        user={user}
        onBack={() => navigate(-1)}
      />
      {/* MEMBERSHIP / PRICE BANNER */}
      {user && !isLimitedView && (akcija.cenaClan != null || akcija.cenaOstali != null) && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 sm:p-4 ${
              effectiveIsClanKluba
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50'
                : 'border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50/70 to-violet-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${effectiveIsClanKluba ? 'bg-emerald-500 text-white' : 'bg-violet-500 text-white'}`}>
                  {effectiveIsClanKluba ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-wider ${effectiveIsClanKluba ? 'text-emerald-700' : 'text-violet-700'}`}>
                    {effectiveIsClanKluba ? 'Tvoj status: član kluba' : 'Tvoj status: gost (van kluba)'}
                  </p>
                  <p className="text-sm text-gray-700 mt-0.5">
                    {effectiveIsClanKluba
                      ? 'Plaćaš povlašćenu cenu za članove kluba.'
                      : akcija.javna
                        ? 'Plaćaš cenu za eksterne učesnike.'
                        : 'Akcija je interna — primenjuje se cena kao za članove.'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tvoja osnovna cena</p>
                <p className={`text-2xl font-extrabold ${effectiveIsClanKluba ? 'text-emerald-700' : 'text-violet-700'}`}>
                  {effectiveBaseCena.toFixed(2)}
                  <span className="text-sm font-bold ml-1">{clubCurrency}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATS BAR */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
            {isFerrataAction ? (
              <>
                {ferrataName && (
                  <StatCell
                    icon={<svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    value={ferrataName}
                    label={t('ferrataRoute')}
                  />
                )}
                {ferrataRegion && (
                  <StatCell
                    icon={<svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>}
                    value={ferrataRegion}
                    label={t('ferrataLocation')}
                  />
                )}
                {ferrataSnap?.duzina_m != null && ferrataSnap.duzina_m > 0 ? (
                  <StatCell
                    icon={<svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-4.5-4.5m4.5 4.5l-4.5 4.5" /></svg>}
                    value={`${ferrataSnap.duzina_m}`}
                    unit="m"
                    label={t('ferrataLength')}
                  />
                ) : ferrataSnap?.visinska_razlika_m != null && ferrataSnap.visinska_razlika_m > 0 ? (
                  <StatCell
                    icon={<svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>}
                    value={`${ferrataSnap.visinska_razlika_m}`}
                    unit="m"
                    label={t('ferrataElevationGain')}
                  />
                ) : ferrataDifficultyLabel ? (
                  <StatCell
                    icon={<svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
                    value={ferrataDifficultyLabel}
                    label={t('difficulty')}
                  />
                ) : null}
              </>
            ) : (
              <>
                {akcija.planina && (
                  <StatCell
                    icon={<svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" /></svg>}
                    value={akcija.planina}
                    label={t('mountain')}
                  />
                )}
                <StatCell
                  icon={<svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>}
                  value={akcija.vrh}
                  label={t('peak')}
                />
                {showPeakHeight && (
                  <StatCell
                    icon={<svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>}
                    value={`${akcija.visinaVrhM}`}
                    unit="m"
                    label={t('height')}
                  />
                )}
              </>
            )}
            <StatCell
              icon={<svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
              value={String(memberCount)}
              label={t('registered')}
            />
          </div>
        </div>
      </div>

      {isLimitedView && (
        <div className="bg-amber-50/70 border-b border-amber-100">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-sm text-amber-800">
              {t('limitedNotice')}
            </p>
          </div>
        </div>
      )}

      {/* BODY */}
      <div className="bg-gray-50/80 min-h-[40vh]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">

          {/* ROW 1: Vodič (lg:8) + Status (lg:4) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Vodič / Kreator card */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">{t('actionDetails')}</h2>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isFerrataAction && ferrataName && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        iconBg="bg-orange-50"
                        label={t('ferrataRoute')}
                        value={ferrataName}
                      />
                    )}
                    {isFerrataAction && ferrataRegion && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                        }
                        iconBg="bg-emerald-50"
                        label={t('ferrataLocation')}
                        value={ferrataRegion}
                      />
                    )}
                    {isFerrataAction && ferrataSnap?.duzina_m != null && ferrataSnap.duzina_m > 0 && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-4.5-4.5m4.5 4.5l-4.5 4.5" />
                          </svg>
                        }
                        iconBg="bg-sky-50"
                        label={t('ferrataLength')}
                        value={`${ferrataSnap.duzina_m} m`}
                      />
                    )}
                    {isFerrataAction && ferrataSnap?.visinska_razlika_m != null && ferrataSnap.visinska_razlika_m > 0 && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                          </svg>
                        }
                        iconBg="bg-amber-50"
                        label={t('ferrataElevationGain')}
                        value={`${ferrataSnap.visinska_razlika_m} m`}
                      />
                    )}
                    {isFerrataAction && ferrataSnap?.obavezna_oprema && ferrataSnap.obavezna_oprema.length > 0 && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        }
                        iconBg="bg-slate-50"
                        label={t('ferrataRequiredGear')}
                        value={ferrataSnap.obavezna_oprema.join(', ')}
                      />
                    )}
                    {(akcija.vodic || akcija.drugiVodicIme) && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        }
                        iconBg="bg-emerald-50"
                        label={t('guides')}
                        value={vodicIme}
                      />
                    )}
                    {akcija.addedBy && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        }
                        iconBg="bg-gray-50"
                        label={t('createdBy')}
                        value={akcija.addedBy.fullName || `@${akcija.addedBy.username}`}
                      />
                    )}
                    {akcija.javna && akcija.klubNaziv && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                          </svg>
                        }
                        iconBg="bg-violet-50"
                        label={t('club')}
                        value={akcija.klubNaziv}
                      />
                    )}
                    <InfoRow
                      icon={
                        <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      }
                      iconBg="bg-sky-50"
                      label={t('date')}
                      value={formatDate(akcija.datum)}
                    />
                    <InfoRow
                      icon={
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      }
                      iconBg="bg-amber-50"
                      label={t('difficulty')}
                      value={difficultyBadge.label}
                    />
                    {isFerrataAction && ferrataCatalogDuration && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        iconBg="bg-indigo-50"
                        label="Trajanje"
                        value={ferrataCatalogDuration}
                      />
                    )}
                    {!isFerrataAction && akcija.trajanjeSati != null && akcija.trajanjeSati > 0 && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        iconBg="bg-indigo-50"
                        label="Trajanje"
                        value={`${akcija.trajanjeSati} h`}
                      />
                    )}
                    {akcija.rokPrijava && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        iconBg="bg-rose-50"
                        label="Rok prijava"
                        value={formatDate(akcija.rokPrijava)}
                      />
                    )}
                    {akcija.maxLjudi != null && akcija.maxLjudi > 0 && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a8.966 8.966 0 01-6 2.28 8.966 8.966 0 01-6-2.28m12 0V16.5a3 3 0 00-3-3h-6a3 3 0 00-3 3v2.22m12 0A3 3 0 0018 15.75V7.5a3 3 0 00-3-3h-.28m-5.44 0H9a3 3 0 00-3 3v8.25a3 3 0 003 3m0-14.25a3 3 0 106 0 3 3 0 00-6 0z" />
                          </svg>
                        }
                        iconBg="bg-violet-50"
                        label="Maks učesnika"
                        value={`${akcija.maxLjudi}`}
                      />
                    )}
                    {akcija.mestoPolaska && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c4.97-4.03 7.5-7.36 7.5-10A7.5 7.5 0 104.5 11c0 2.64 2.53 5.97 7.5 10z" />
                          </svg>
                        }
                        iconBg="bg-teal-50"
                        label="Polazak"
                        value={akcija.mestoPolaska}
                      />
                    )}
                  </div>

                  {akcija.opis && (
                    <div className="pt-4 border-t border-gray-50 lg:hidden">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('actionDescription')}</h3>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{akcija.opis}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status / quick stats card */}
              <div className="lg:col-span-4 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">{t('statusTitle')}</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    {akcija.isCompleted ? (
                      <>
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t('completed')}</p>
                          <p className="text-[11px] text-gray-400">{t('completedHint')}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t('activeHintTitle')}</p>
                          <p className="text-[11px] text-gray-400">{t('activeHint')}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50/80 border border-gray-100">
                      <span className="text-[11px] text-gray-500 font-medium">{t('registeredCountLabel')}</span>
                      <span className="text-sm font-bold text-gray-900">{memberCount}</span>
                    </div>
                    {akcija.isCompleted && user && canManageHost && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
                        <span className="text-[11px] text-emerald-600 font-medium">{t('climbedCountLabel')}</span>
                        <span className="text-sm font-bold text-emerald-700">{uspesnoPopeli.length}</span>
                      </div>
                    )}
                    {mojaPrijava && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-bold">Tvoja prijava</span>
                        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                          {prijavaStatusLabel(mojaPrijava.status, t)}
                        </span>
                      </div>
                    )}
                    {user && akcija.cenaClan != null && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-50 border border-amber-100">
                        <span className="text-[11px] text-amber-700 font-medium">Tvoja cena (član)</span>
                        <span className="text-sm font-bold text-amber-800 tabular-nums">
                          {akcija.cenaClan.toFixed(2)} {clubCurrency}
                        </span>
                      </div>
                    )}
                    {user && akcija.javna && akcija.cenaOstali != null && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-violet-50 border border-violet-100">
                        <span className="text-[11px] text-violet-700 font-medium">Cena za ostale</span>
                        <span className="text-sm font-bold text-violet-800 tabular-nums">
                          {akcija.cenaOstali.toFixed(2)} {clubCurrency}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: Logistics */}
            {(akcija.prevoz?.length || akcija.smestaj?.length || akcija.opremaRent?.length || akcija.oprema?.length) ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Transport (lg:7) */}
                <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-1 h-5 rounded-full bg-gradient-to-b from-sky-400 to-indigo-600" />
                      <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Prevoz</h2>
                      {!!akcija.prevoz?.length && (
                        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-100">
                          {akcija.prevoz.length} opcija
                        </span>
                      )}
                    </div>
                    {!!user && !!mojaPrijava && !akcija.isCompleted && (
                      <button
                        type="button"
                        onClick={() => setAddTransportOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 shadow-sm transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Dodaj prevoz
                      </button>
                    )}
                  </div>
                  <div className="p-5 sm:p-6">
                    {!akcija.prevoz?.length ? (
                      <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
                        <p className="text-sm text-gray-500">
                          Trenutno nema dostupnih opcija prevoza.
                          {!!user && !!mojaPrijava && !akcija.isCompleted && ' Možete dodati svoj prevoz dugmetom iznad.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {akcija.prevoz.map((p) => (
                          <TransportCard
                            key={p.id}
                            id={p.id}
                            tipPrevoza={p.tipPrevoza}
                            nazivGrupe={p.nazivGrupe}
                            kapacitet={p.kapacitet}
                            cenaPoOsobi={p.cenaPoOsobi}
                            currency={clubCurrency}
                            participants={prevozPrijave[p.id] || []}
                            myUsername={user?.username}
                            selected={selPrevoz.has(p.id)}
                            disabled={!user || akcija.isCompleted || (mojaPrijava != null && mojaPrijava.status !== 'prijavljen')}
                            onToggle={() => togglePrevoz(p.id)}
                            canDelete={!!user && canManageHostAkcija(user, {
        klubId: akcija.klubId,
        organizatorTip: akcija.organizatorTip,
        vodicId: akcija.vodicId,
        vodicUsername: akcija.vodic?.username,
      }) && !akcija.isCompleted}
                            onRequestDelete={() => handleDeletePrevoz({ id: p.id, nazivGrupe: p.nazivGrupe })}
                          />
                        ))}
                      </div>
                    )}
                    {!user && !!akcija.prevoz?.length && (
                      <p className="mt-4 text-[11px] text-gray-500 text-center">
                        <Link
                          to="/login"
                          state={{ returnTo: `${location.pathname}${location.search}` }}
                          className="text-sky-600 font-bold hover:text-sky-700"
                        >
                          Prijavite se
                        </Link>{' '}
                        da biste mogli da odaberete prevoz.
                      </p>
                    )}
                  </div>
                </div>

                {/* Right column: Smestaj + Oprema */}
                <div className="lg:col-span-5 space-y-6">
                  {!!akcija.smestaj?.length && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
                      <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                        <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Smeštaj</h2>
                      </div>
                      <div className="p-5 sm:p-6 space-y-3">
                        {akcija.smestaj.map((s) => (
                          <AccommodationCard
                            key={s.id}
                            id={s.id}
                            naziv={s.naziv}
                            opis={s.opis}
                            cenaPoOsobiUkupno={s.cenaPoOsobiUkupno}
                            currency={clubCurrency}
                            selected={selSmestaj.has(s.id)}
                            disabled={!user || akcija.isCompleted || (mojaPrijava != null && mojaPrijava.status !== 'prijavljen')}
                            onToggle={() => toggleSmestaj(s.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {(!!akcija.oprema?.length || !!akcija.opremaRent?.length) && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
                      <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500" />
                        <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Oprema</h2>
                      </div>
                      <div className="p-5 sm:p-6 space-y-2">
                        {equipmentList.map((it) => (
                          <EquipmentItem
                            key={it.key}
                            naziv={it.naziv}
                            obavezna={it.obavezna}
                            rent={it.rent}
                            currency={clubCurrency}
                            selectedKolicina={it.rent ? selRent[it.rent.rentId] || 0 : 0}
                            disabled={!user || akcija.isCompleted || (mojaPrijava != null && mojaPrijava.status !== 'prijavljen')}
                            onChange={(qty) => it.rent && setRentQty(it.rent.rentId, qty)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* ROW 3: Confirm / Summary */}
            {user && !isLimitedView && !akcija.isCompleted && (akcija.cenaClan != null || akcija.cenaOstali != null) && (
              <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-r from-white via-emerald-50/80 to-white shadow-md">
                <div className="px-5 sm:px-7 py-4 border-b border-emerald-100/70 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600" />
                  <h2 className="text-sm sm:text-base font-bold text-emerald-900 tracking-tight">Pregled tvojih izbora i ukupnog zaduženja</h2>
                </div>
                <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-3 gap-5">

                  {/* Breakdown list */}
                  <div className="lg:col-span-2 space-y-2">
                    <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-white border border-gray-100">
                      <span className="text-xs font-semibold text-gray-700">
                        Osnovna cena akcije{' '}
                        <span className={`text-[10px] font-bold uppercase ml-1 ${effectiveIsClanKluba ? 'text-emerald-700' : 'text-violet-700'}`}>
                          ({effectiveIsClanKluba ? 'član kluba' : akcija.javna ? 'gost' : 'klub'})
                        </span>
                      </span>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">
                        {effectiveBaseCena.toFixed(2)} {clubCurrency}
                      </span>
                    </div>

                    {summaryRows.map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-white border border-gray-100">
                        <span className="text-xs text-gray-700 truncate">
                          <span className={`text-[10px] font-bold uppercase mr-2 px-1.5 py-0.5 rounded ${row.tagBg}`}>{row.tag}</span>
                          {row.label}
                        </span>
                        <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0 ml-2">
                          {row.amount.toFixed(2)} {clubCurrency}
                        </span>
                      </div>
                    ))}

                    {summaryRows.length === 0 && (
                      <p className="text-[11px] text-gray-500 italic px-3.5">
                        Nema dodatnih izbora pored osnovne cene.
                      </p>
                    )}
                  </div>

                  {/* Total + button */}
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-50/90">Ukupno za uplatu</p>
                      <p className="mt-1 text-3xl sm:text-4xl font-extrabold tabular-nums">
                        {totalSummary.toFixed(2)}
                        <span className="text-base font-bold ml-1.5 opacity-90">{clubCurrency}</span>
                      </p>
                      {akcija.mojSaldo != null && Math.abs(akcija.mojSaldo - totalSummary) > 0.01 && (
                        <p className="mt-1.5 text-[10px] text-emerald-50/85">
                          Trenutno na profilu: <span className="font-bold">{akcija.mojSaldo.toFixed(2)} {clubCurrency}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      <button
                        type="button"
                        onClick={handleSavePrijavaOrUpdate}
                        disabled={savingSelections || (mojaPrijava != null && !selectionsDirty)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-extrabold bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {savingSelections
                          ? 'Čuvam…'
                          : mojaPrijava
                            ? selectionsDirty
                              ? 'Sačuvaj izmene izbora'
                              : 'Izbori su sačuvani'
                            : 'Potvrdi i prijavi se'}
                      </button>
                      {mojaPrijava && mojaPrijava.status === 'prijavljen' && (
                        <button
                          type="button"
                          onClick={handleCancelPrijava}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-emerald-50 bg-emerald-700/40 hover:bg-emerald-700/55 border border-emerald-300/30 transition-colors"
                        >
                          Otkaži prijavu
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          

            {/* ROW 4: Members list (FULL WIDTH) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible">
              <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">{t('registeredMembers')}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {canManageHost && canSeePrijave && !isLimitedView && prijave.length > 0 && (
                    <>
                      {!bulkPaymentMode ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBulkPaymentMode(true)
                            setBulkSelectedPaymentIds(new Set())
                          }}
                          className="inline-flex items-center h-8 px-3 rounded-lg text-[11px] font-bold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                          Označi ko je platio
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleToggleSelectAllBulkPayments}
                            className="inline-flex items-center h-8 px-3 rounded-lg text-[11px] font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Označi sve
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkMarkAsPaid}
                            disabled={bulkPaymentSubmitting}
                            className="inline-flex items-center h-8 px-3 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {bulkPaymentSubmitting ? 'Plaćam...' : 'Plati'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkPaymentMode(false)
                              setBulkSelectedPaymentIds(new Set())
                            }}
                            disabled={bulkPaymentSubmitting}
                            className="inline-flex items-center h-8 px-3 rounded-lg text-[11px] font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            {t('cancel')}
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {canManageHost && canSeePrijave && !isLimitedView && (
                    <span className="inline-flex items-center justify-center h-6 px-2 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                      Plaćeno {paidCount}/{paymentTrackedPrijave.length}
                    </span>
                  )}
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                    {memberCount}
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {!user && (
                  <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 mb-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500">
                      <Link
                        to="/login"
                        state={{ returnTo: `${location.pathname}${location.search}` }}
                        className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                      >
                        Prijavite se
                      </Link>{' '}
                      na akciju, ako nemate nalog{' '}
                      <button
                        type="button"
                        onClick={() => setRegisterOptionsOpen(true)}
                        className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors underline-offset-2 hover:underline"
                      >
                        registrujte se
                      </button>
                      .
                    </p>
                  </div>
                )}

                {user && canSeePrijave && prijave.length === 0 && (
                  <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 mb-3">
                      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400">{t('noRegisteredMembersYet')}</p>
                  </div>
                )}

                {user && !canSeePrijave && !isLimitedView && (
                  <div className="rounded-xl bg-gradient-to-br from-sky-50/80 to-gray-50 border border-sky-100/80 p-5 space-y-3">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Potpun spisak prijavljenih nije dostupan za ovu akciju. Ukupno prijavljenih:{' '}
                      <span className="font-semibold text-gray-900">{akcija.prijaveCount ?? 0}</span>.
                    </p>
                  </div>
                )}

                {user && canSeePrijave && !isLimitedView && prijave.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {prijave.map((p) => {
                      const displayName = p.fullName?.trim() ? p.fullName : p.korisnik || 'Nepoznat'
                      const initial = displayName.charAt(0).toUpperCase()
                      const statusCls = PRIJAVA_STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-500 border-gray-200'
                      const avatar = p.avatarUrl || (p as any).avatar_url

                      return (
                        <div
                          key={p.id}
                          className={`group flex items-center gap-3 p-3 rounded-2xl bg-gray-50/60 border border-gray-100 transition-all duration-200 ${
                            canOpenMemberModal && !bulkPaymentMode
                              ? canManageHost
                                ? p.platio
                                  ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm cursor-pointer'
                                  : 'border-rose-200 bg-rose-50/30 hover:border-rose-300 hover:bg-rose-50/50 hover:shadow-sm cursor-pointer'
                                : 'border-gray-100 hover:border-emerald-200/80 hover:bg-emerald-50/25 hover:shadow-sm cursor-pointer'
                              : ''
                          }`}
                          role={canOpenMemberModal && !bulkPaymentMode ? 'button' : undefined}
                          tabIndex={canOpenMemberModal && !bulkPaymentMode ? 0 : -1}
                          onClick={canOpenMemberModal && !bulkPaymentMode ? () => setMemberModal(p) : undefined}
                          onKeyDown={canOpenMemberModal && !bulkPaymentMode
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setMemberModal(p)
                                }
                              }
                            : undefined}
                        >
                          {canManageHost && bulkPaymentMode && (
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleBulkSelectionForUser(p)}
                                disabled={!!p.platio || bulkPaymentSubmitting}
                                className={`inline-flex items-center justify-center h-6 w-6 rounded-md border transition-colors ${
                                  p.platio
                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                    : bulkSelectedPaymentIds.has(p.id)
                                      ? 'border-emerald-500 bg-emerald-500 text-white'
                                      : 'border-gray-300 bg-white text-gray-500 hover:border-emerald-400'
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                                title={p.platio ? 'Već plaćeno' : 'Označi člana kao plaćeno'}
                                aria-label={p.platio ? 'Već plaćeno' : 'Označi člana kao plaćeno'}
                              >
                                {(p.platio || bulkSelectedPaymentIds.has(p.id)) ? (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : null}
                              </button>
                            </div>
                          )}
                          <div className="relative w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm flex-shrink-0">
                            {avatar ? (
                              <img src={avatar} alt={displayName} className="absolute inset-0 w-full h-full object-cover" />
                            ) : null}
                            <span className={avatar ? 'invisible' : ''}>{initial}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                              <UserNameWithProfiBadge name={displayName} isProfiGuide={p.isProfiGuide} badgeSize={16} />
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">

                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${statusCls}`}>
                                {prijavaStatusLabel(p.status, t)}
                              </span>
                              {canManageHost && typeof p.saldo === 'number' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 tabular-nums">
                                  {p.saldo.toFixed(2)} {clubCurrency}
                                </span>
                              )}
                              {p.isClanKluba === false && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                                  Gost
                                </span>
                              )}
                            </div>
                          </div>
                          {canManageHost && !akcija.isCompleted && p.status === 'prijavljen' && (
                            <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'popeo se')}
                                className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                title={t('markClimbed')}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'nije uspeo')}
                                className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                                title={t('markFailed')}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          )}
                          {canManageHost && !akcija.isCompleted && (p.status === 'popeo se' || p.status === 'nije uspeo') && (
                            <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'prijavljen')}
                                className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                                title="Reset statusa na prijavljen"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-.518 4.992A9 9 0 106.5 19.5l1.5-1.5" />
                                </svg>
                              </button>
                            </div>
                          )}
                          {canManageHost && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveFromAction(p.id, displayName)
                              }}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 text-gray-500 hover:bg-rose-100 hover:text-rose-600 transition-colors shrink-0"
                              title={t('removeFromAction')}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397M5.79 5.79a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {user && canManageHost && canSeePrijave && !isLimitedView && prijave.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Sve uplate</p>
                        <p className="text-sm text-gray-700 mt-0.5">
                          Plaćeno članova: <span className="font-bold text-emerald-700">{paidCount}</span> / {paymentTrackedPrijave.length}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-semibold text-gray-500">Ukupno plaćeno</p>
                        <p className="text-lg font-extrabold text-emerald-700 tabular-nums">
                          {paidTotal.toFixed(2)} {clubCurrency}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Očekivano ukupno: <span className="font-semibold text-gray-700">{expectedTotal.toFixed(2)} {clubCurrency}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {user && canSeePrijave && canManageHost && akcija.isCompleted && !isLimitedView && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Dodaj clana koji se uspesno popeo
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="flex-1">
                        <Dropdown
                          aria-label="Izaberi clana za dodavanje na zavrsenu akciju"
                          options={[
                            { value: '', label: 'Izaberi clana' },
                            ...membersToAdd.map((m) => ({
                              value: String(m.id),
                              label: `${m.fullName?.trim() || m.username} (@${m.username})`,
                            })),
                          ]}
                          value={selectedMemberId}
                          onChange={setSelectedMemberId}
                          fullWidth
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCompletedMember}
                        disabled={!selectedMemberId || addingMember}
                        className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {addingMember ? 'Dodajem...' : 'Dodaj'}
                      </button>
                    </div>
                    {membersToAdd.length === 0 && (
                      <p className="text-xs text-gray-500">Svi clanovi kluba su vec oznaceni kao uspesno popeo se.</p>
                    )}
                    {addingMemberError && (
                      <p className="text-xs text-rose-600">{addingMemberError}</p>
                    )}
                  </div>
                )}

                {user && canSeePrijave && canManageHost && akcija.isCompleted && !isLimitedView && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Dodaj člana van kluba
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Pretraži korisnike iz drugih klubova ili bez kluba. Akcija će im se upisati tek nakon potvrde, bez finansija.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
                        Pending zahtevi: {pendingExternalRequestCount}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] gap-4">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1">
                          <button
                            type="button"
                            onClick={() => setExternalScope('other-clubs')}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                              externalScope === 'other-clubs'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            Drugi klubovi
                          </button>
                          <button
                            type="button"
                            onClick={() => setExternalScope('no-club')}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                              externalScope === 'no-club'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            Bez kluba
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                            Pretraga po imenu ili @username
                          </label>
                          <input
                            type="text"
                            value={externalSearch}
                            onChange={(e) => setExternalSearch(e.target.value)}
                            placeholder="npr. Marko ili @marko"
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                          />
                        </div>

                        <div
                          className="space-y-2 max-h-[360px] overflow-y-auto pr-1"
                          onScroll={handleExternalCandidatesScroll}
                        >
                          {externalCandidates.length === 0 && externalLoading ? (
                            <p className="text-xs text-gray-500">Pretražujem korisnike...</p>
                          ) : externalCandidates.length === 0 ? (
                            <p className="text-xs text-gray-500">
                              {externalSearch.trim()
                                ? 'Nema korisnika za ovu pretragu.'
                                : 'Prikazujemo 5 profila. Skrolom naniže učitava se sledećih 5.'}
                            </p>
                          ) : (
                            <>
                              {externalCandidates.map((candidate) => {
                                const displayName = candidate.fullName?.trim() || candidate.username
                                const clubLabel = candidate.klubNaziv?.trim() || 'Bez kluba'
                                return (
                                  <div
                                    key={candidate.id}
                                    className="rounded-2xl border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                                      <p className="text-xs text-gray-500 truncate">@{candidate.username}</p>
                                      <p className="text-[11px] text-gray-400 truncate">{clubLabel}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void handleSendExternalRequest(candidate)}
                                      disabled={sendingExternalRequestId === candidate.id}
                                      className="shrink-0 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {sendingExternalRequestId === candidate.id ? 'Šaljem...' : 'Pošalji zahtev'}
                                    </button>
                                  </div>
                                )
                              })}
                              {externalLoading && (
                                <p className="text-xs text-gray-500 text-center py-1">Učitavam još 5 profila...</p>
                              )}
                            </>
                          )}
                        </div>
                        {externalError && <p className="text-xs text-rose-600">{externalError}</p>}
                      </div>

                      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Poslati zahtevi</p>
                            <p className="text-xs text-gray-500 mt-1">Ovde vidiš šta još čeka potvrdu i šta je već obrađeno.</p>
                          </div>
                          {requestsLoading && <span className="text-[11px] text-gray-400">Učitavanje...</span>}
                        </div>

                        <div className="mt-3 space-y-2.5">
                          {actionParticipationRequests.length === 0 ? (
                            <p className="text-xs text-gray-500">Još nema poslatih zahteva za ovu akciju.</p>
                          ) : (
                            actionParticipationRequests.map((request) => {
                              const targetLabel = request.targetUser.fullName?.trim() || request.targetUser.username
                              const targetClubLabel = request.targetUser.klubNaziv?.trim() || 'Bez kluba'
                              const statusStyle =
                                request.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : request.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : request.status === 'rejected'
                                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                                      : 'bg-gray-100 text-gray-700 border-gray-200'
                              const statusLabel =
                                request.status === 'pending'
                                  ? 'Čeka potvrdu'
                                  : request.status === 'accepted'
                                    ? 'Prihvaćeno'
                                    : request.status === 'rejected'
                                      ? 'Odbijeno'
                                      : 'Otkazano'
                              return (
                                <div key={request.id} className="rounded-2xl border border-amber-100 bg-white/90 px-3 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{targetLabel}</p>
                                      <p className="text-xs text-gray-500 truncate">@{request.targetUser.username} · {targetClubLabel}</p>
                                      <p className="text-[11px] text-gray-400 mt-1">
                                        Poslato {formatDate(request.createdAt)}
                                        {request.respondedAt ? ` · obrađeno ${formatDate(request.respondedAt)}` : ''}
                                      </p>
                                    </div>
                                    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle}`}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  {request.status === 'pending' && (
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => void handleCancelExternalRequest(request)}
                                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                      >
                                        Otkaži zahtev
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ROW 5: Summit share + ocena vodiča + Admin */}
            {(showSummitImageCard || canShowGuideRatingPrompt || guideRatingSubmitted || (canManageHost && !isLimitedView)) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {showSummitImageCard && (
                  <div className="lg:order-1 bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden ring-1 ring-emerald-500/10">
                    <div className="px-5 py-4 border-b border-emerald-50 flex items-center gap-2.5 bg-gradient-to-r from-emerald-50/80 to-teal-50/40">
                      <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600" />
                      <h3 className="text-sm font-bold text-gray-900 tracking-tight">{t('summitImageTitle')}</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <p className="text-[12px] text-gray-500 leading-relaxed">
                        Podeli link akcije i pozovi ekipu jednim klikom. Nagradu možeš preuzeti nakon uspešnog uspona.
                      </p>
                      <button
                        type="button"
                        onClick={openSummitShareModal}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500 hover:from-emerald-400 hover:via-teal-500 hover:to-emerald-400 shadow-md shadow-emerald-200/50 border border-emerald-400/30 transition-all"
                      >
                        <svg className="w-5 h-5 shrink-0 opacity-95" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        {t('summitShareButton')}
                      </button>
                    </div>
                  </div>
                )}

                {canShowGuideRatingPrompt && (
                  <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden ring-1 ring-amber-500/10">
                    <div className="px-5 py-4 border-b border-amber-50 bg-gradient-to-r from-amber-50/80 to-emerald-50/40 flex items-center gap-2.5">
                      <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-500" />
                      <h3 className="text-sm font-bold text-gray-900 tracking-tight">{t('guideRatingCardTitle')}</h3>
                    </div>
                    <div className="p-5 space-y-3">
                      <p className="text-[12px] text-gray-600 leading-relaxed">
                        {t('guideRatingCardHint', { name: guideRatingGuideName })}
                      </p>
                      <button
                        type="button"
                        onClick={() => setGuideRatingOpen(true)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-200/50 transition-all"
                      >
                        {t('guideRatingCardButton')}
                      </button>
                    </div>
                  </div>
                )}

                {guideRatingSubmitted && (
                  <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden p-5">
                    <p className="text-sm font-bold text-emerald-900">{t('guideRatingAlreadyTitle')}</p>
                    <p className="mt-1 text-xs text-gray-600">{t('guideRatingAlreadyHint')}</p>
                  </div>
                )}

                {canManageHost && !isLimitedView && (
                  <div className="lg:order-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                      <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                      <h3 className="text-sm font-bold text-gray-900 tracking-tight">{t('managementTitle')}</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {!akcija.isCompleted && (
                        <button
                          onClick={openFinishFinanceModal}
                          className="sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/50 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          {t('finishAction')}
                        </button>
                      )}
                      <button
                        onClick={handleEdit}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        {t('editAction')}
                      </button>
                      {!akcija.isCompleted ? (
                        <button
                          onClick={handlePrintPrePolaska}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          {t('printPdf')}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handlePrintPrePolaska}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            {t('printBeforeDeparture')}
                          </button>
                          <button
                            onClick={handlePrintZavrsena}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            {t('printCompleted')}
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleDelete}
                        className="sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        {t('deleteAction')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          <AddTransportModal
            open={addTransportOpen}
            currency={clubCurrency}
            onClose={() => setAddTransportOpen(false)}
            onSubmit={handleAddTransport}
          />

          <FinishActionFinanceModal
            open={finishFinanceModalOpen}
            currency={clubCurrency}
            prihodUkupan={paidTotal}
            skipClubFinances={akcija.organizatorTip === 'vodic'}
            onClose={() => setFinishFinanceModalOpen(false)}
            onConfirm={handleConfirmFinishFinance}
          />

          <MemberDetailsModal
            open={canOpenMemberModal && !!memberModal}
            onClose={() => setMemberModal(null)}
            currency={clubCurrency}
            member={canOpenMemberModal ? (memberModal as any) : null}
            smestaj={akcija.smestaj || []}
            prevoz={(akcija.prevoz || []).map((p) => ({ id: p.id, nazivGrupe: p.nazivGrupe, tipPrevoza: p.tipPrevoza, cenaPoOsobi: p.cenaPoOsobi }))}
            opremaRent={(akcija.opremaRent || []).map((o) => ({ id: o.id, nazivOpreme: o.nazivOpreme, cenaPoSetu: o.cenaPoSetu }))}
            baseCenaClan={akcija.cenaClan ?? 0}
            baseCenaOstali={akcija.cenaOstali ?? 0}
            javna={!!akcija.javna}
            statusLabel={memberModal ? prijavaStatusLabel(memberModal.status, t) : ''}
            showPaymentControls={canManageHost && !akcija.isCompleted}
            onTogglePayment={memberModal ? async (next) => handleTogglePaymentStatus(memberModal.id, next) : undefined}
          />

        </div>
      </div>

      <GuideRatingModal
        open={guideRatingOpen && canShowGuideRatingPrompt && !guideRatingSkipped}
        guideName={guideRatingGuideName}
        saving={guideRatingSaving}
        onClose={() => setGuideRatingOpen(false)}
        onSkip={handleGuideRatingSkip}
        onSubmit={handleGuideRatingSubmit}
      />

      {summitShareOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onClick={closeSummitShareModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="summit-share-title"
            className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/90 to-teal-50/50">
              <h2 id="summit-share-title" className="text-sm font-bold text-gray-900 tracking-tight">
                {t('summitShareModalTitle')}
              </h2>
              <button
                type="button"
                onClick={closeSummitShareModal}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800 transition-colors"
                aria-label={t('summitShareClose')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {summitShareStep === 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Link akcije</p>
                  <div className="space-y-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-[11px] text-gray-500 mb-1">Podelite ovaj link u grupi:</p>
                      <p className="text-xs font-medium text-gray-800 break-all">
                        {actionShareLoading ? 'Kreiram link...' : actionShareUrl || resolveActionPublicUrl()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyActionShareLink()}
                      disabled={actionShareLoading || !actionShareUrl}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Kopiraj
                    </button>
                    {actionShareCopied && (
                      <p className="text-xs text-emerald-700 text-center">Link je kopiran.</p>
                    )}
                    {actionShareError && (
                      <p className="text-xs text-rose-600">{actionShareError}</p>
                    )}
                  </div>

                  {!canClaimSummitReward ? (
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                      Popni akciju i preuzmi nagradu
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSummitShareStep(1)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500 hover:from-emerald-400 hover:via-teal-500 hover:to-emerald-400 shadow-md shadow-emerald-200/50 border border-emerald-400/30 transition-all"
                    >
                      Preuzmi nagradu
                    </button>
                  )}
                </>
              )}

              {summitShareStep === 1 && isFerrataReward && (
                <>
                  <button
                    type="button"
                    onClick={() => setSummitShareStep(0)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('summitBack')}
                  </button>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Via ferrata bedž</p>
                  <p className="text-[11px] text-gray-400 leading-snug">
                    Preuzmi personalizovani bedž sa imenom ferate, datumom i ocenom.
                  </p>
                  <div className="rounded-xl overflow-hidden bg-gradient-to-b from-neutral-100 to-neutral-200 ring-1 ring-gray-200 shadow-inner">
                    {summitPreviewLoading ? (
                      <div className="w-full aspect-[3/4] min-h-[280px] animate-pulse bg-neutral-300" />
                    ) : ferrataBadgePreview ? (
                      <img
                        src={ferrataBadgePreview}
                        alt="Via ferrata bedž"
                        className="w-full h-auto block"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full aspect-[3/4] min-h-[280px] flex items-center justify-center text-sm text-neutral-500">
                        —
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFerrataBadgeDownload()}
                    disabled={summitPreviewLoading || !ferrataBadgePreview}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500 hover:from-emerald-400 hover:via-teal-500 hover:to-emerald-400 shadow-md shadow-emerald-200/50 border border-emerald-400/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preuzmi bedž
                  </button>
                </>
              )}

              {summitShareStep === 1 && !isFerrataReward && (
                <>
                  <button
                    type="button"
                    onClick={() => setSummitShareStep(0)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('summitBack')}
                  </button>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('summitStepChooseFormat')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSummitPickedAspect('9:16')
                        setSummitShareStep(2)
                      }}
                      className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 border border-emerald-400/20 shadow-sm transition-all"
                    >
                      <span className="text-lg font-extrabold tabular-nums">9 : 16</span>
                      <span className="text-[10px] font-semibold opacity-90">{t('summitFormatPortraitHint')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSummitPickedAspect('16:9')
                        setSummitShareStep(2)
                      }}
                      className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-sm font-bold text-emerald-800 bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/80 transition-all"
                    >
                      <span className="text-lg font-extrabold tabular-nums">16 : 9</span>
                      <span className="text-[10px] font-semibold text-emerald-700/80">{t('summitFormatLandscapeHint')}</span>
                    </button>
                  </div>
                </>
              )}

              {summitShareStep === 2 && !isFerrataReward && summitPickedAspect && (
                <>
                  <button
                    type="button"
                    onClick={() => setSummitShareStep(1)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('summitBack')}
                  </button>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('summitStepChooseLayout')}</p>
                  <p className="text-[11px] text-gray-400 leading-snug">{t('summitPreviewTapHint')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSummitPngDownload(summitPickedAspect, 'balanced')}
                      disabled={summitPreviewLoading}
                      className="group flex flex-col gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label={t('summitLayoutBalancedTitle')}
                    >
                      <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-neutral-700 to-neutral-900 ring-2 ring-white/10 shadow-inner group-hover:ring-emerald-400/80 group-focus-visible:ring-emerald-500 transition-all">
                        {summitPreviewLoading ? (
                          <div
                            className="w-full animate-pulse bg-neutral-600"
                            style={{
                              aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9',
                              minHeight: 120,
                            }}
                          />
                        ) : summitPreviewBalanced ? (
                          <img
                            src={summitPreviewBalanced}
                            alt=""
                            className="w-full h-auto block"
                            draggable={false}
                          />
                        ) : (
                          <div
                            className="w-full flex items-center justify-center text-[10px] text-neutral-400 p-4"
                            style={{ aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9' }}
                          >
                            —
                          </div>
                        )}
                      </div>
                      <span className="text-center text-[11px] font-bold text-gray-800 group-hover:text-emerald-700">
                        {t('summitLayoutBalancedTitle')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSummitPngDownload(summitPickedAspect, 'stacked')}
                      disabled={summitPreviewLoading}
                      className="group flex flex-col gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label={t('summitLayoutStackedTitle')}
                    >
                      <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-neutral-700 to-neutral-900 ring-2 ring-white/10 shadow-inner group-hover:ring-emerald-400/80 group-focus-visible:ring-emerald-500 transition-all">
                        {summitPreviewLoading ? (
                          <div
                            className="w-full animate-pulse bg-neutral-600"
                            style={{
                              aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9',
                              minHeight: 120,
                            }}
                          />
                        ) : summitPreviewStacked ? (
                          <img
                            src={summitPreviewStacked}
                            alt=""
                            className="w-full h-auto block"
                            draggable={false}
                          />
                        ) : (
                          <div
                            className="w-full flex items-center justify-center text-[10px] text-neutral-400 p-4"
                            style={{ aspectRatio: summitPickedAspect === '9:16' ? '9 / 16' : '16 / 9' }}
                          >
                            —
                          </div>
                        )}
                      </div>
                      <span className="text-center text-[11px] font-bold text-gray-800 group-hover:text-emerald-700">
                        {t('summitLayoutStackedTitle')}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {registerOptionsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setRegisterOptionsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-options-title"
            className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/90 to-teal-50/50">
              <h2 id="register-options-title" className="text-sm font-bold text-gray-900 tracking-tight">
                Izaberite način registracije
              </h2>
              <button
                type="button"
                onClick={() => setRegisterOptionsOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800 transition-colors"
                aria-label="Zatvori"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setRegisterOptionsOpen(false)
                  navigate('/registracija-kod')
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 transition-all"
              >
                Imam kod kluba
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegisterOptionsOpen(false)
                  navigate('/registracija')
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all"
              >
                Registracija bez koda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
