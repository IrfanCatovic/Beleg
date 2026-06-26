import * as Location from 'expo-location'
import { requestStepsAccess } from './stepsAccess'
import { checkLocationReadiness } from './locationReadiness'

export type ActivityPermissionResult =
  | { ok: true }
  | { ok: false; message: string }

export async function requestActivityPermissions(): Promise<ActivityPermissionResult> {
  const readiness = await checkLocationReadiness()
  if (!readiness.ready) {
    if (readiness.issue === 'services_off') {
      return {
        ok: false,
        message: 'Lokacija na telefonu je isključena. Uključi GPS u postavkama da započneš avanturu.',
      }
    }
    return {
      ok: false,
      message: 'Dozvola za lokaciju je potrebna za snimanje rute.',
    }
  }

  const { status: locStatus } = await Location.getForegroundPermissionsAsync()
  if (locStatus !== 'granted') {
    const { status: requested } = await Location.requestForegroundPermissionsAsync()
    if (requested !== 'granted') {
      return { ok: false, message: 'Dozvola za lokaciju je potrebna za snimanje rute.' }
    }
  }

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
  if (bgStatus !== 'granted') {
    return {
      ok: false,
      message: 'Dozvola za lokaciju u pozadini je potrebna da avantura radi dok je app minimizovan.',
    }
  }

  const steps = await requestStepsAccess()
  if (steps.status === 'permission_denied') {
    return { ok: false, message: 'Dozvola za korake je isključena u postavkama.' }
  }
  if (steps.status === 'device_unavailable') {
    return { ok: false, message: 'Brojač koraka nije dostupan na ovom uređaju.' }
  }

  return { ok: true }
}
