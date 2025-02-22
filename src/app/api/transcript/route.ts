import { NextResponse } from "next/server"
import { YoutubeTranscript } from "youtube-transcript"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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

    // Get transcript with try-catch for better error handling
    console.log("Fetching transcript for video:", videoId)
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)

      if (!transcript || transcript.length === 0) {
        return NextResponse.json(
          { message: "No transcript available for this video" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        videoId,
        videoUrl: url,
        transcript
      })
    } catch (transcriptError) {
      console.error("Transcript specific error:", transcriptError)
      return NextResponse.json(
        { message: "Failed to fetch transcript. Please try again." },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Transcript fetch error:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to fetch transcript" },
      { status: 500 }
    )
  }
} 