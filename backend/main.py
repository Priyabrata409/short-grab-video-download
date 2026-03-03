import os
import yt_dlp
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import uuid
import shutil

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "ShortGrab API is running"}

@app.get("/health")
async def health_check():
    import socket
    domains = ["www.google.com", "www.youtube.com", "www.instagram.com"]
    dns_results = {}
    for domain in domains:
        try:
            socket.gethostbyname(domain)
            dns_results[domain] = "ok"
        except Exception as e:
            dns_results[domain] = f"failed: {str(e)}"
    
    return {
        "status": "healthy",
        "dns_diagnostics": dns_results
    }

DOWNLOAD_DIR = "downloads"
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

class MediaRequest(BaseModel):
    url: str

def get_yt_dlp_options(is_audio=False, output_path=""):
    if is_audio:
        return {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': output_path,
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
        }
    else:
        return {
            'format': 'bestvideo+bestaudio/best',
            'outtmpl': output_path,
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'source_address': '0.0.0.0', # Force IPv4
        }

@app.post("/api/info")
async def get_info(request: MediaRequest):
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'nocheckcertificate': True}) as ydl:
            info = ydl.extract_info(request.url, download=False)
            
            # Prefer 'thumbnail' but fallback to the first item in 'thumbnails' list
            thumbnail = info.get('thumbnail')
            if not thumbnail and info.get('thumbnails'):
                thumbnail = info.get('thumbnails')[-1].get('url')
            
            print(f"Extracted info: {info.get('title')} - Thumbnail: {thumbnail}")
            
            return {
                "title": info.get('title'),
                "thumbnail": thumbnail,
                "duration": info.get('duration'),
                "uploader": info.get('uploader'),
                "platform": info.get('extractor_key')
            }
    except Exception as e:
        print(f"Info Error: {e}")
        raise HTTPException(status_code=400, detail=f"Error: {str(e)}")

@app.get("/api/proxy-thumbnail")
async def proxy_thumbnail(url: str):
    try:
        import requests
        response = requests.get(url, stream=True, verify=False)
        if response.status_code == 200:
            from fastapi import Response
            return Response(
                content=response.content,
                media_type=response.headers.get('content-type', 'image/jpeg')
            )
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch image")
    except Exception as e:
        print(f"Proxy Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download/video")
async def download_video(request: MediaRequest):
    try:
        file_id = str(uuid.uuid4())
        output_template = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")
        
        ydl_opts = get_yt_dlp_options(is_audio=False, output_path=output_template)
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=True)
            filename = ydl.prepare_filename(info)
            # yt-dlp might change extension
            actual_filename = filename
            if not os.path.exists(actual_filename):
                # Search for the file with the same ID
                for f in os.listdir(DOWNLOAD_DIR):
                    if f.startswith(file_id):
                        actual_filename = os.path.join(DOWNLOAD_DIR, f)
                        break
            
            return FileResponse(
                path=actual_filename,
                filename=f"{info.get('title', 'video')}.mp4",
                media_type='video/mp4'
            )
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=400, detail="Failed to download video. It might be private or restricted.")

@app.post("/api/download/mp3")
async def download_mp3(request: MediaRequest):
    try:
        file_id = str(uuid.uuid4())
        output_template = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")
        
        ydl_opts = get_yt_dlp_options(is_audio=True, output_path=output_template)
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=True)
            # The output will be .mp3 due to postprocessor
            actual_filename = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")
            
            if os.path.exists(actual_filename):
                return FileResponse(
                    path=actual_filename,
                    filename=f"{info.get('title', 'audio')}.mp3",
                    media_type='audio/mpeg'
                )
            else:
                 raise HTTPException(status_code=500, detail="Audio extraction failed.")
                 
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=400, detail="Failed to download audio. It might be private or restricted.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
