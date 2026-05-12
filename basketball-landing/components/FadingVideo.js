const { useEffect, useRef } = React;

const FadingVideo = ({ src, className = "" }) => {
    const videoRef = useRef(null);
    const fadeRequestRef = useRef(null);
    const FADE_MS = 500;
    const FADE_OUT_LEAD = 0.55;

    const fadeTo = (target, duration) => {
        const video = videoRef.current;
        if (!video) return;

        const startOpacity = parseFloat(video.style.opacity) || 0;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentOpacity = startOpacity + (target - startOpacity) * progress;
            
            video.style.opacity = currentOpacity;

            if (progress < 1) {
                fadeRequestRef.current = requestAnimationFrame(animate);
            }
        };

        if (fadeRequestRef.current) cancelAnimationFrame(fadeRequestRef.current);
        fadeRequestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.style.opacity = 0;

        const handleTimeUpdate = () => {
            if (video.duration - video.currentTime <= FADE_OUT_LEAD) {
                fadeTo(0, FADE_MS);
            }
        };

        const handleEnded = () => {
            video.currentTime = 0;
            video.play();
            fadeTo(1, FADE_MS);
        };

        const handleCanPlay = () => {
            video.play();
            fadeTo(1, FADE_MS);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('canplay', handleCanPlay);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('canplay', handleCanPlay);
            if (fadeRequestRef.current) cancelAnimationFrame(fadeRequestRef.current);
        };
    }, [src]);

    return (
        <video
            ref={videoRef}
            src={src}
            autoPlay
            muted
            playsInline
            preload="auto"
            className={`w-full h-full object-cover transition-opacity duration-0 ${className}`}
            style={{ opacity: 0 }}
        />
    );
};

window.FadingVideo = FadingVideo;
