const express = require('express');
const ytdl = require('@distube/ytdl-core');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Suppress warnings and prevent debug file creation
process.removeAllListeners('warning');
process.on('warning', () => {});
console.warn = () => {};

// Safe way to disable ytdl-core debug features
try {
    if (ytdl.cache && ytdl.cache.sig) ytdl.cache.sig.set = () => {};
    if (ytdl.cache && ytdl.cache.info) ytdl.cache.info.set = () => {};
} catch (err) {
    // Ignore if cache is not accessible
}

const app = express();
const PORT = process.env.PORT || 3300;

// Middleware
app.use(cors());
app.use(express.json());

// Create cookies array (هام جداً للسيرفرات الحقيقية)
const cookies = [
    {
        name: 'VISITOR_INFO1_LIVE',
        value: 'uDBFDVm3fnU', // ضع قيمة حقيقية
        domain: '.youtube.com',
        path: '/',
        expires: Date.now() + 3600000 * 24 * 30,
        httpOnly: true,
        secure: true,
        sameSite: 'None'
    },
    {
        name: 'CONSENT',
        value: '-5XUoAVv-vw', // أو قيمة حقيقية
        domain: '.youtube.com',
        path: '/',
        expires: Date.now() + 3600000 * 24 * 30,
        httpOnly: false,
        secure: true,
        sameSite: 'None'
    }
];

// Create agent with proper configuration
const agent = ytdl.createAgent(cookies, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    }
});

// Get video details
app.get('/api/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid YouTube video ID'
            });
        }

        // Configure ytdl with options
        const ytdlOptions = {
            agent: agent, // استخدام الـ agent مع الـ cookies
            quality: 'highest',
            filter: 'audioandvideo',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Referer': 'https://www.youtube.com/'
                },
                maxRetries: 3,
                maxReconnects: 3,
                backoff: { inc: 500, max: 10000 }
            },
            debug: false,
            silent: true,
            writeDebugFile: false,
            highWaterMark: 1 << 25, // 32MB
            dlChunkSize: 1024 * 1024 * 10, // 10MB
            IPv6Block: '2001:2::/48' // يساعد في بعض السيرفرات
        };

        console.log(`Fetching info for video: ${videoId}`);
        
        const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, ytdlOptions);
        const formats = info.formats;

        // Get video formats with quality
        const videoFormats = formats.filter(f => 
            f.hasVideo && 
            f.qualityLabel && 
            f.url
        );

        // Get audio formats
        const audioFormats = formats.filter(f => 
            f.hasAudio && 
            !f.hasVideo && 
            f.audioBitrate && 
            f.url
        );

        // Find the strongest audio
        const strongestAudio = audioFormats.reduce((best, current) => {
            return (!best || current.audioBitrate > best.audioBitrate) ? current : best;
        }, null);

        // Get unique video qualities
        const uniqueVideoQualities = [];
        const seenHeights = new Set();

        videoFormats
            .sort((a, b) => b.height - a.height)
            .forEach(format => {
                if (!seenHeights.has(format.height)) {
                    seenHeights.add(format.height);
                    uniqueVideoQualities.push({
                        quality: format.qualityLabel,
                        directUrl: format.url,
                        width: format.width,
                        height: format.height,
                        fps: format.fps || 30,
                        bitrate: format.bitrate,
                        mimeType: format.mimeType,
                        codecs: format.codecs,
                        hasAudio: format.hasAudio
                    });
                }
            });

        res.json({
            success: true,
            data: {
                videoId,
                title: info.videoDetails.title,
                author: info.videoDetails.author.name,
                duration: info.videoDetails.lengthSeconds,
                thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url,
                videoQualities: uniqueVideoQualities,
                strongestAudio: strongestAudio ? {
                    quality: `${strongestAudio.audioBitrate}`,
                    directUrl: strongestAudio.url,
                    bitrate: strongestAudio.audioBitrate,
                    mimeType: strongestAudio.mimeType,
                    codecs: strongestAudio.codecs
                } : null
            }
        });

        // Clean up debug files
        cleanupDebugFiles();

    } catch (error) {
        console.error('Error fetching video:', error.message);
        console.error('Stack:', error.stack);
        
        // إرسال رسالة خطأ أكثر تفصيلاً في بيئة التطوير
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'Please try again later';
            
        res.status(500).json({
            success: false,
            error: 'Failed to fetch video information',
            details: errorMessage,
            // في بيئة التطوير، أضف المزيد من التفاصيل
            ...(process.env.NODE_ENV === 'development' && {
                debug: {
                    message: error.message,
                    code: error.code,
                    statusCode: error.statusCode
                }
            })
        });
    }
});

// Function to clean up debug files
function cleanupDebugFiles() {
    try {
        const files = fs.readdirSync('.');
        files.forEach(file => {
            if (file.includes('player-script.js') || 
                file.includes('watch.html') || 
                file.match(/^\d+-.*\.(js|html)$/)) {
                try {
                    fs.unlinkSync(file);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
        });
    } catch (err) {
        // Ignore if can't read directory
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        node: process.version,
        memory: process.memoryUsage()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Middleware error:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 YouTube API is running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    cleanupDebugFiles();
});

// Clean up on exit
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    cleanupDebugFiles();
    process.exit(0);
});

// Prevent unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;