import * as Location from 'expo-location'
import { requestStepsAccess } from './stepsAccess'

export type ActivityPermissionResult =
  | { ok: true }
  | { ok: false; message: string }

export async function requestActivityPermissions(): Promise<ActivityPermissionResult> {
  const { status: locStatus } = await Location.requestForegroundPermissionsAsync()
  if (locStatus !== 'granted') {
    return { ok: false, message: 'Dozvola za lokaciju je potrebna za snimanje rute.' }
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
