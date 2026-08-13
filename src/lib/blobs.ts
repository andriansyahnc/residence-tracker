import { getStore } from '@netlify/blobs'

export function iplUploadStore() {
  return getStore('ipl-uploads')
}

export async function putIplBlob(
  key: string,
  bytes: Uint8Array,
  contentType: string,
) {
  await iplUploadStore().set(key, bytes, {
    metadata: { contentType },
  })
}

export async function getIplBlob(key: string) {
  const result = await iplUploadStore().get(key, { type: 'arrayBuffer' })
  return result ? new Uint8Array(result) : null
}
