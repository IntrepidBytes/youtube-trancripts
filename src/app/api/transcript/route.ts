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
      // Add more debugging
      console.log("Starting transcript fetch attempt...")
      
      // Try with specific language first
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: 'en'
        })
        console.log("Transcript fetch successful with language specification")
        return NextResponse.json({
          videoId,
          videoUrl: url,
          transcript
        })
      } catch (langError) {
        console.log("Failed with language specification, trying without:", langError)
      }

      // Try without language specification as fallback
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)

      if (!transcript || transcript.length === 0) {
        console.log("No transcript data returned")
        return NextResponse.json(
          { message: "No transcript available for this video" },
          { status: 404 }
        )
      }

      console.log("Transcript fetch successful")
      return NextResponse.json({
        videoId,
        videoUrl: url,
        transcript
      })
    } catch (transcriptError: any) {
      console.error("Transcript specific error:", transcriptError)
      console.error("Error details:", {
        message: transcriptError.message,
        stack: transcriptError.stack,
        name: transcriptError.name
      })
      
      // Return more detailed error information
      return NextResponse.json(
        { 
          message: "Failed to fetch transcript. Please try again.",
          error: transcriptError.message,
          videoId
        },
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