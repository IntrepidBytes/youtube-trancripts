import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

async function fetchTranscript(videoId: string) {
  try {
    // First fetch the video page
    console.log('Fetching video page...')
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch video page: ${response.status}`)
    }

    const html = await response.text()
    console.log('Successfully fetched video page')

    // Extract the INNERTUBE_API_KEY
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)
    if (!apiKeyMatch) {
      throw new Error('Could not find API key')
    }
    const apiKey = apiKeyMatch[1]
    console.log('Found API key')

    // Extract client version
    const clientVersionMatch = html.match(/"clientVersion":"([^"]+)"/)
    if (!clientVersionMatch) {
      throw new Error('Could not find client version')
    }
    const clientVersion = clientVersionMatch[1]
    console.log('Found client version')

    // Get transcript list
    console.log('Fetching transcript list...')
    const transcriptListResponse = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: JSON.stringify({
        context: {
          client: {
            hl: "en",
            gl: "US",
            clientName: "WEB",
            clientVersion: clientVersion,
            clientScreen: "WATCH",
            mainAppWebInfo: {
              graftUrl: `/watch?v=${videoId}`
            }
          }
        },
        videoId
      })
    })

    if (!transcriptListResponse.ok) {
      console.error('Transcript list response:', await transcriptListResponse.text())
      throw new Error(`Failed to fetch transcript list: ${transcriptListResponse.status}`)
    }

    const transcriptListData = await transcriptListResponse.json()
    console.log('Transcript list data:', JSON.stringify(transcriptListData, null, 2))

    // Find the English transcript
    const transcriptRenderer = transcriptListData?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
    if (!transcriptRenderer) {
      throw new Error('No transcript data found')
    }

    const transcriptItems = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments
    if (!transcriptItems?.length) {
      throw new Error('No transcript segments found')
    }

    console.log('Found transcript segments')

    // Format the transcript
    const transcript = transcriptItems.map((segment: any) => {
      const renderer = segment.transcriptSegmentRenderer
      return {
        text: renderer.snippet.runs[0].text,
        start: parseFloat(renderer.startMs) / 1000,
        duration: (parseFloat(renderer.endMs) - parseFloat(renderer.startMs)) / 1000
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