const express = require('express');
const ytdl = require('@distube/ytdl-core');
const cors = require('cors');
const fs = require('fs');
// Suppress warnings and prevent debug file creation
process.removeAllListeners('warning');
process.on('warning', () => {}); // Ignore all warnings
console.warn = () => {}; // Disable console warnings

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

        // Configure ytdl with options to suppress warnings and debug files
        const ytdlOptions = {
            quality: 'highest',
            filter: 'audioandvideo',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            },
            // Disable debug file creation
            debug: false,
            silent: true,
            // Prevent writing debug files
            writeDebugFile: false
        };

        const info = await ytdl.getInfo(videoId, ytdlOptions);
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

        // Find the strongest audio (highest bitrate)
        const strongestAudio = audioFormats.reduce((best, current) => {
            return (!best || current.audioBitrate > best.audioBitrate) ? current : best;
        }, null);

        // Get unique video qualities (remove duplicates by height)
        const uniqueVideoQualities = [];
        const seenHeights = new Set();

        videoFormats
            .sort((a, b) => b.height - a.height) // Sort by height descending
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

        const files = fs.readdirSync('.');
        files.forEach(file => {
            if (file.includes('player-script.js') || 
                file.includes('watch.html') || 
                file.match(/^\d+-.*\.(js|html)$/)) {
                try {
                    fs.unlinkSync(file);
                    // console.log(`🗑️  Cleaned up debug file: ${file}`);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
        });

    } catch (error) {
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch video information',
            details: 'Please try again later'
        });
    }
});


// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
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
        
    try {
        const files = fs.readdirSync('.');
        files.forEach(file => {
            if (file.includes('player-script.js') || 
                file.includes('watch.html') || 
                file.match(/^\d+-.*\.(js|html)$/)) {
                try {
                    fs.unlinkSync(file);
                    console.log(`🗑️  Cleaned up debug file: ${file}`);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
        });
    } catch (err) {
        // Ignore if can't read directory
    }
});

// Clean up debug files on exit
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    
    const fs = require('fs');
    try {
        const files = fs.readdirSync('.');
        files.forEach(file => {
            if (file.includes('player-script.js') || 
                file.includes('watch.html') || 
                file.match(/^\d+-.*\.(js|html)$/)) {
                try {
                    fs.unlinkSync(file);
                    console.log(`🗑️  Cleaned up: ${file}`);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
        });
    } catch (err) {
        // Ignore cleanup errors
    }
    
    process.exit(0);
});

// Prevent unhandled promise rejections from showing warnings
process.on('unhandledRejection', () => {});

module.exports = app;
