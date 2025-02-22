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

    // Get video details with more reliable fetch configuration
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
    console.log("Fetching video details from:", apiUrl.replace(process.env.YOUTUBE_API_KEY || "", "[API_KEY]"))
    
    const videoInfoResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://ytt.ibytes.site'
      },
      next: { revalidate: 0 }
    })
    
    if (!videoInfoResponse.ok) {
      const errorData = await videoInfoResponse.json().catch(() => ({}))
      console.error("Video info fetch failed:", {
        status: videoInfoResponse.status,
        statusText: videoInfoResponse.statusText,
        error: errorData
      })
      return NextResponse.json(
        { message: `Failed to fetch video details: ${videoInfoResponse.statusText}` },
        { status: videoInfoResponse.status }
      )
    }

    const videoInfo = await videoInfoResponse.json()
    if (!videoInfo.items?.length) {
      return NextResponse.json(
        { message: "Video not found or API key invalid" },
        { status: 404 }
      )
    }
    
    const videoTitle = videoInfo.items[0]?.snippet?.title || "Untitled Video"

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
        videoTitle,
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