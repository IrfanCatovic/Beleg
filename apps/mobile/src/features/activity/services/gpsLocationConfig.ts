import * as Location from 'expo-location'
import {
  ADVENTURE_GPS_ACCURACY_HIGH,
  ADVENTURE_GPS_DISTANCE_INTERVAL_M,
  ADVENTURE_GPS_TIME_INTERVAL_MS,
  ADVENTURE_IOS_ACTIVITY_TYPE_FITNESS,
} from './gpsLocationConstants'

export {
  ADVENTURE_GPS_ACCURACY_HIGH,
  ADVENTURE_GPS_DISTANCE_INTERVAL_M,
  ADVENTURE_GPS_TIME_INTERVAL_MS,
  ADVENTURE_IOS_ACTIVITY_TYPE_FITNESS,
} from './gpsLocationConstants'

export const ADVENTURE_GPS_ACCURACY = Location.Accuracy.High ?? ADVENTURE_GPS_ACCURACY_HIGH

export const ADVENTURE_GPS_WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: ADVENTURE_GPS_ACCURACY,
  timeInterval: ADVENTURE_GPS_TIME_INTERVAL_MS,
  distanceInterval: ADVENTURE_GPS_DISTANCE_INTERVAL_M,
}

const FITNESS_ACTIVITY_TYPE =
  (Location as { ActivityType?: { Fitness?: number } }).ActivityType?.Fitness ??
  ADVENTURE_IOS_ACTIVITY_TYPE_FITNESS

export const ADVENTURE_GPS_BACKGROUND_OPTIONS = {
  ...ADVENTURE_GPS_WATCH_OPTIONS,
  pausesUpdatesAutomatically: false,
  activityType: FITNESS_ACTIVITY_TYPE,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Planiner avantura',
    notificationBody: 'Praćenje rute je aktivno.',
  },
} as Location.LocationTaskOptions
