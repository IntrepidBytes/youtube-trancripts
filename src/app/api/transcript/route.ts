import { NextResponse } from "next/server"
import { YoutubeTranscript } from "youtube-transcript"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

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
      console.log("Starting transcript fetch attempt...")
      
      // Try with all available options
      const options = {
        lang: 'en',
        country: 'US',
        userAgent: USER_AGENT,
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': USER_AGENT
        }
      }

      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, options)
        console.log("Transcript fetch successful with options")
        return NextResponse.json({
          videoId,
          videoUrl: url,
          transcript
        })
      } catch (optionsError) {
        console.log("Failed with options, trying basic fetch:", optionsError)
        
        // Try basic fetch as fallback
        const transcript = await YoutubeTranscript.fetchTranscript(videoId)
        
        if (!transcript || transcript.length === 0) {
          console.log("No transcript data returned")
          return NextResponse.json(
            { message: "No transcript available for this video" },
            { status: 404 }
          )
        }

        console.log("Basic transcript fetch successful")
        return NextResponse.json({
          videoId,
          videoUrl: url,
          transcript
        })
      }
    } catch (transcriptError: any) {
      console.error("Transcript specific error:", transcriptError)
      console.error("Error details:", {
        message: transcriptError.message,
        stack: transcriptError.stack,
        name: transcriptError.name
      })
      
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