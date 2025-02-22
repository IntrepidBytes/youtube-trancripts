import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

async function fetchTranscript(videoId: string) {
  try {
    // First fetch the video page to get the captions data
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    })

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`)
    }

    const html = await pageResponse.text()
    console.log('Successfully fetched video page')

    // Try to find the captions track
    const captionsMatch = html.match(/"captionTracks":\[(.*?)\]/)
    if (!captionsMatch) {
      throw new Error('No captions found in video data')
    }

    const captions = JSON.parse(`[${captionsMatch[1]}]`)
    console.log('Found caption tracks:', captions.length)

    // Find English captions or auto-generated English captions
    const englishCaptions = captions.find((track: any) => 
      track.languageCode === 'en' || 
      (track.languageCode === 'en' && track.kind === 'asr')
    )

    if (!englishCaptions) {
      throw new Error('No English captions available')
    }

    const captionsUrl = englishCaptions.baseUrl
    console.log('Found captions URL')

    // Fetch the actual transcript
    const transcriptResponse = await fetch(captionsUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`)
    }

    const transcriptXml = await transcriptResponse.text()
    console.log('Successfully fetched transcript XML')

    // Parse the transcript XML
    const lines = transcriptXml.match(/<text[^>]*>(.*?)<\/text>/g) || []
    const transcript = lines.map(line => {
      const startMatch = line.match(/start="([^"]*)"/)
      const durMatch = line.match(/dur="([^"]*)"/)
      const textMatch = line.match(/>([^<]*)</)

      if (!startMatch || !durMatch || !textMatch) return null

      return {
        text: decodeURIComponent(textMatch[1].replace(/\+/g, ' ')),
        start: parseFloat(startMatch[1]),
        duration: parseFloat(durMatch[1])
      }
    }).filter(Boolean)

    if (transcript.length === 0) {
      throw new Error('Failed to parse transcript data')
    }

    console.log('Successfully parsed transcript with', transcript.length, 'lines')
    return transcript
  } catch (error) {
    console.error('Detailed transcript fetch error:', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    // Extract video ID from URL (now handles both standard and shortened URLs with parameters)
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]

    if (!videoId) {
      return NextResponse.json(
        { message: "Invalid YouTube URL" },
        { status: 400 }
      )
    }

    console.log("Fetching transcript for video:", videoId)
    
    try {
      const transcript = await fetchTranscript(videoId)
      
      return NextResponse.json({
        videoId,
        videoUrl: url,
        transcript
      })
    } catch (error: any) {
      console.error("Transcript error:", error)
      return NextResponse.json(
        { 
          message: "Failed to fetch transcript. Please try again.",
          error: error.message,
          videoId
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Request error:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    )
  }
} 