import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

async function fetchTranscript(videoId: string) {
  try {
    // First, fetch the transcript list
    const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`
    const response = await fetch(timedTextUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch transcript list: ${response.status}`)
    }

    const text = await response.text()
    
    // Parse the XML to find the transcript URL
    const match = text.match(/lang_code="([^"]*)".*name="([^"]*)"/)
    if (!match) {
      throw new Error('No transcript available')
    }

    const [, langCode] = match
    
    // Fetch the actual transcript
    const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}`
    const transcriptResponse = await fetch(transcriptUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      },
      cache: 'no-store'
    })

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`)
    }

    const transcriptText = await transcriptResponse.text()
    
    // Parse the XML transcript
    const lines = transcriptText.match(/<text[^>]*>(.*?)<\/text>/g) || []
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
      throw new Error('No transcript content found')
    }

    return transcript
  } catch (error) {
    console.error('Transcript fetch error:', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    // Extract video ID from URL
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