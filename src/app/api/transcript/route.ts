import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

async function fetchTranscript(videoId: string) {
  try {
    // Direct request to YouTube's transcript endpoint
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch video page: ${response.status}`)
    }

    const html = await response.text()
    
    // Extract the serializedShareEntity which contains the transcript data
    const match = html.match(/"serializedShareEntity":"([^"]+)"/)
    if (!match) {
      throw new Error('Could not find transcript data')
    }

    // Get the actual transcript data
    const transcriptUrl = `https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`
    const transcriptResponse = await fetch(transcriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'DESKTOP',
            clientVersion: '2.20240311.01.00',
            hl: 'en',
            gl: 'US'
          }
        },
        params: match[1]
      })
    })

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`)
    }

    const data = await transcriptResponse.json()
    const transcriptData = data.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups

    const transcript = transcriptData.map((group: any) => {
      const cue = group.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
      return {
        text: cue.cue.simpleText,
        start: parseFloat(cue.startOffsetMs) / 1000,
        duration: (parseFloat(cue.durationMs) / 1000)
      }
    })

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