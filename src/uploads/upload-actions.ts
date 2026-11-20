'use server'

import { z } from 'zod'

import { requireActionAccess } from '@/rex/rex-access'
import { rexIdSchema } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'
import { UPLOAD_LIMIT, uploadFile } from '@/uploads/upload-file'

/** Uploads a file to the pane's computer; returns the path to paste into the pane. */
export const uploadFileAction = requireActionAccess(
  async (formData: FormData) => {
    const input = z
      .object({
        file: z
          .instanceof(File)
          .refine(
            (file) => file.size <= UPLOAD_LIMIT,
            'File is larger than 25 MB',
          ),
        host: z.string(),
        session: rexIdSchema,
      })
      .parse(Object.fromEntries(formData))
    return uploadFile({
      bytes: Buffer.from(await input.file.arrayBuffer()),
      host: await requireHost(input.host),
      name: input.file.name,
      session: input.session,
    })
  },
)
