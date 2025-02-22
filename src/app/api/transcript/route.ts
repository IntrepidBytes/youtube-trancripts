import { NextResponse } from "next/server"
import { YoutubeTranscript } from 'youtube-transcript-api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

async function fetchTranscript(videoId: string) {
  try {
    console.log('Fetching transcript with youtube-transcript-api')
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
      country: 'US'
    })
    
    console.log('Successfully fetched transcript')
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