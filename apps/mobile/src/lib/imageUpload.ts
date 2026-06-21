import * as ImageManipulator from 'expo-image-manipulator'
import type { ImagePickerAsset } from 'expo-image-picker'

export type FormDataFilePart = {
  uri: string
  name: string
  type: string
}

type PrepareOptions = {
  maxWidth?: number
  compress?: number
}

/**
 * Pripremi sliku iz ImagePicker-a za multipart upload.
 * Na Androidu crop često vraća URI bez ekstenzije — backend validira .jpg/.png u imenu fajla.
 * Manipulator normalizuje u JPEG sa poznatim file:// putem i ispravnim MIME tipom.
 */
export async function prepareImagePickerAssetForUpload(
  asset: ImagePickerAsset,
  baseName: string,
  options?: PrepareOptions,
): Promise<FormDataFilePart> {
  const actions: ImageManipulator.Action[] = []
  if (options?.maxWidth && asset.width && asset.width > options.maxWidth) {
    actions.push({ resize: { width: options.maxWidth } })
  }

  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: options?.compress ?? 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  return {
    uri: result.uri,
    name: `${baseName}.jpg`,
    type: 'image/jpeg',
  }
}

export function appendImageToFormData(
  formData: FormData,
  fieldName: string,
  file: FormDataFilePart,
): void {
  formData.append(fieldName, file as unknown as Blob)
}
