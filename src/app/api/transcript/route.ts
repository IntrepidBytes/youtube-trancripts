import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

async function fetchTranscript(videoId: string) {
  try {
    // First try to get the transcript list
    const response = await fetch(`https://youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch video page: ${response.status}`)
    }

    const html = await response.text()
    
    // Extract the captions URL from the YouTube page
    const innertubeApiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1]
    const clientVersion = html.match(/"clientVersion":"([^"]+)"/)?.[1]
    
    if (!innertubeApiKey || !clientVersion) {
      throw new Error('Could not extract required keys from video page')
    }

    // Get the transcript using YouTube's internal API
    const transcriptResponse = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${innertubeApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: clientVersion,
          },
        },
        videoId: videoId,
      })
    })

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to fetch transcript data: ${transcriptResponse.status}`)
    }

    const data = await transcriptResponse.json()
    
    // Parse the transcript data
    const transcriptData = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments || []
    
    if (!transcriptData.length) {
      throw new Error('No transcript content found in response')
    }

    const transcript = transcriptData.map((segment: any) => ({
      text: segment.transcriptSegmentRenderer.snippet.text,
      start: parseFloat(segment.transcriptSegmentRenderer.startTimeSeconds),
      duration: parseFloat(segment.transcriptSegmentRenderer.endTimeSeconds) - parseFloat(segment.transcriptSegmentRenderer.startTimeSeconds)
    }))

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