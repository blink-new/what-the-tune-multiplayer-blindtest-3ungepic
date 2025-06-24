import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const DEEZER_API_URL = 'https://api.deezer.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { playlistId } = await req.json()
    if (!playlistId) {
      throw new Error('Playlist ID is required')
    }

    const response = await fetch(`${DEEZER_API_URL}/playlist/${playlistId}/tracks`)
    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})