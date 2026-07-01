import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import { syncDailySteps } from '@beleg/shared'
import { client } from '../../../api/client'
import { getTodaySteps } from '../../steps/services/stepsService'
import { shouldSyncSteps } from '../../steps/types/stepsTypes'
import { setCachedDailySteps, todayKey } from './stepsLocalStore'

export const STEPS_BACKGROUND_TASK = 'planiner-daily-steps-sync'

async function syncStepsOnce(): Promise<boolean> {
  const result = await getTodaySteps()
  if (!shouldSyncSteps(result)) return false
  const day = todayKey()
  await setCachedDailySteps(day, result.steps)
  try {
    const res = await syncDailySteps(client, { date: day, steps: result.steps })
    await setCachedDailySteps(day, res.steps)
    return true
  } catch {
    return false
  }
}

if (!TaskManager.isTaskDefined(STEPS_BACKGROUND_TASK)) {
  TaskManager.defineTask(STEPS_BACKGROUND_TASK, async () => {
    try {
      const ok = await syncStepsOnce()
      return ok
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed
    }
  })
}

export async function registerStepsBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync()
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return
    }
    const registered = await TaskManager.isTaskRegisteredAsync(STEPS_BACKGROUND_TASK)
    if (!registered) {
      await BackgroundFetch.registerTaskAsync(STEPS_BACKGROUND_TASK, {
        minimumInterval: 60 * 15,
        stopOnTerminate: false,
        startOnBoot: true,
      })
    }
  } catch {
    // background fetch unavailable on this build
  }
}

export { syncStepsOnce }
