import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.341.0"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.341.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileName, fileType } = await req.json()

    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION') || 'ap-southeast-2',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      },
    })

    const bucketName = 'paramount-qa-evidence-vault'
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ContentType: fileType,
      ACL: 'public-read',
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 })

    return new Response(
      JSON.stringify({ 
        presignedUrl, 
        publicUrl: `https://${bucketName}.s3.${Deno.env.get('AWS_REGION') || 'ap-southeast-2'}.amazonaws.com/${fileName}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), 
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})