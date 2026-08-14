/**
 * Hiking adventure GPS acquisition constants.
 *
 * High (~10 m class) for both foreground watch and background task so we no
 * longer pair Balanced (~100 m) with a 50 m validator reject.
 *
 * BestForNavigation exists on Expo 19 but uses extra sensors and higher
 * battery; High is the hiking-appropriate default.
 *
 * Expo semantics: timeInterval AND distanceInterval are both minimums.
 * Slow walk ~3 km/h reaches 5 m in ~6 s, so updates are distance-gated rather
 * than 1 Hz. Validator still drops sub-3 m jitter.
 *
 * Location.Accuracy.High === 4
 * Location.ActivityType.Fitness === 3
 */
export const ADVENTURE_GPS_ACCURACY_HIGH = 4
export const ADVENTURE_GPS_TIME_INTERVAL_MS = 3000
export const ADVENTURE_GPS_DISTANCE_INTERVAL_M = 5
export const ADVENTURE_IOS_ACTIVITY_TYPE_FITNESS = 3
