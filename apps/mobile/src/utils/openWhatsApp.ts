import { Linking } from 'react-native'
import { encodeWhatsAppShareMessage } from '@beleg/shared'

export async function openWhatsAppWithMessage(message: string): Promise<void> {
  const { appUrl, webUrl } = encodeWhatsAppShareMessage(message)
  try {
    const canOpen = await Linking.canOpenURL(appUrl)
    if (canOpen) {
      await Linking.openURL(appUrl)
    } else {
      await Linking.openURL(webUrl)
    }
  } catch {
    await Linking.openURL(webUrl)
  }
}
